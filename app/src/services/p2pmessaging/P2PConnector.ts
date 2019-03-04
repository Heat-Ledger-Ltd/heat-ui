/*
 * The MIT License (MIT)
 * Copyright (c) 2019 Heat Ledger Ltd.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 * */

module p2p {

  /**
   * Provides WebRTC channels through rooms using signaling server.
   * Keeps websocket connection alive so that other party will can to establish WebRTC channel using signaling websocket connection.
   */
  export class P2PConnector {

    rooms: Map<string, Room> = new Map<string, Room>(); // roomName -> room

    private static MSG_TYPE_CHECK_CHANNEL = "CHECK_CHANNEL";
    private static MSG_TYPE_REQUEST_PROOF_IDENTITY = "GET_PROOF_IDENTITY";
    private static MSG_TYPE_RESPONSE_PROOF_IDENTITY = "PROOF_IDENTITY";

    private webSocketPromise: Promise<WebSocket>;
    private signalingMessageAwaitings: Function[] = [];
    private notAcceptedResponse = "notAcceptedResponse_@)(%$#&#&";

    private createRoom: (name: string, peerId) => Room;
    private confirmIncomingCall: (caller: string) => Promise<void>;
    private sign: (dataHex: string) => ProvingData;
    private signalingError: (reason: string) => void;

    private pendingIdentity: string;
    private identity: string;
    private pendingRooms: Function[] = [];
    private pendingOnlineStatus: Function;
    private _onlineStatus: OnlineStatus = "offline";
    private signalingReady: boolean = null;
    private config = {iceServers: [{urls: 'stun:23.21.150.121'}, {urls: 'stun:stun.l.google.com:19302'}]};
    private pingSignalingInterval;

    constructor(private settings: SettingsService, private $interval: angular.IIntervalService) {
    }

    /**
     * @param identity
     * @param createRoom function to create the room on incoming call
     * @param confirmIncomingCall function to accept the caller
     * @param signalingError
     * @param sign Signing delegated to client class because this service class should not to have deal with secret info
     */
    setup(identity: string,
          createRoom: (name: string, peerId) => Room,
          confirmIncomingCall: (caller: string) => Promise<void>,
          signalingError: (reason: string) => void,
          sign: (dataHex: string) => ProvingData) {
      this.pendingIdentity = identity;
      this.createRoom = createRoom;
      this.confirmIncomingCall = confirmIncomingCall;
      this.sign = sign;
      this.signalingError = signalingError;
    }

    /**
     * Sets online status on the server side for the peer associated with this connector (websocket connection for signaling).
     */
    setOnlineStatus(status: OnlineStatus) {
      let sendOnlineStatus = () => {
        this.sendSignalingMessage([{type: "SET_ONLINE_STATUS", status: status}]);
      };
      if (this.identity) {
        sendOnlineStatus();
      } else {
        this.sendSignalingMessage([{type: "WANT_PROVE_IDENTITY"}]);
        this.pendingOnlineStatus = sendOnlineStatus;
      }
      this._onlineStatus = status;
      if (status == "offline") {
        this.identity = null;
        //todo clear rooms?
      }
    }

    get onlineStatus(): OnlineStatus {
      return this._onlineStatus;
    }

    getPeerOnlineStatus(peerId: string): Promise<string> {
      return this.request(
        () => this.sendSignalingMessage([{type: "GET_ONLINE_STATUS", peerId: peerId}]),
        (msg) => {
          if (msg.type === "ONLINE_STATUS" && msg.peerId == peerId)
            return msg.status;
          return this.notAcceptedResponse;
        })
    }

    call(toPeerId: string, caller: string, room: Room) {
      this.sendSignalingMessage([{type: "CALL", toPeerId: toPeerId, caller: caller, room: room.name}]);
    }

    getTmp(roomName: string): Promise<Array<string>> {
      return this.request(
        () => this.sendSignalingMessage([{type: "WHO_ONLINE"}]),
        (msg) => {
          if (msg.type === "WHO_ONLINE")
            return msg.remotePeerIds;
          return this.notAcceptedResponse;
        })
    }

    enter(room: Room, enforce?: boolean) {
      let existingRoom = this.rooms.get(room.name);
      if (existingRoom && existingRoom.state.entered == "entered") {
        if (enforce) {
          existingRoom.state.entered = "not";
        } else {
          return;
        }
      }
      let requestEnterRoom = () => {
        room.state.approved = true;
        if (room.state.entered == "not") {
          room.state.entered = "entering";

          //will return the state to not entered if will no the response from the server
          setTimeout(() => {
            if (room.state.entered != "entered") {
              room.state.entered = "not";
            }
          }, 4000);

          //request entering to the room
          this.sendSignalingMessage([{type: "ROOM", room: room.name}]);
        }
      };

      this.rooms.set(room.name, room);

      if (this.identity) {
        requestEnterRoom();
      } else {
        this.pendingRooms.push(requestEnterRoom);
        this.sendSignalingMessage([{type: "WANT_PROVE_IDENTITY"}]);
        return;
      }
    }

    /**
     * Resolves opened websocket.
     */
    getWebSocket() {
      if (!this.webSocketPromise || this.signalingReady === false) {
        this.webSocketPromise = new Promise((resolve, reject) => {
            let url = this.settings.get(SettingsService.HEAT_WEBSOCKET);
            let socket = new WebSocket(url);
            console.log("new socket, readyState=" + socket.readyState);
            socket.onopen = () => {
              socket.onmessage = (msg) => this.onSignalingMessage(msg);
              socket.onclose = () => this.onSignalingChannelClosed();
              this.signalingReady = true;
              if (this.pingSignalingInterval) {
                this.$interval.cancel(this.pingSignalingInterval);
              }
              this.pingSignalingInterval = this.$interval(() => {
                this.pingSignalingServer(socket);
              }, 120 * 1000, 0, false);
              resolve(socket);
            };
            socket.onerror = (error) => {
              console.log(error);
              reject(error);
            };
          }
        );
      }
      return this.webSocketPromise;
    }

    private pingSignalingServer(socket: WebSocket) {
      if (this.signalingReady) {
        this.sendSignalingMessage([{type: "PING"}]);
      }
    }

    sendSignalingMessage(message: any[]): Promise<any> {
      return this.getWebSocket().then(websocket => {
        message.splice(0, 0, "webrtc");
        websocket.send(JSON.stringify(message));
        console.log(">> \n"+JSON.stringify(message));
      }, reason => console.log(reason))
    }

    onSignalingMessage(message) {
      if (this._onlineStatus == "offline") {
        return;
      }
      console.log("<< \n"+ message.data);
      let msg = JSON.parse(message.data);
      let roomName: string = msg.room;

      if (msg.type === 'PONG') {
        //console.log("signaling pong");
      } else if (msg.type === 'PROVE_IDENTITY') {
        let signedData = this.sign(msg.data);
        signedData["type"] = P2PConnector.MSG_TYPE_RESPONSE_PROOF_IDENTITY;
        this.sendSignalingMessage([signedData]);
      } else if (msg.type === 'APPROVED_IDENTITY') {
        this.identity = this.pendingIdentity;
        this.pendingRooms.forEach(f => f());
        this.pendingRooms = [];
        if (this.pendingOnlineStatus)
          this.pendingOnlineStatus();
        this.pendingOnlineStatus = null;
      } else if (msg.type === 'CALL') {
        let caller: string = msg.caller;
        this.confirmIncomingCall(caller).then(value => {
          let room = this.createRoom(roomName, caller);
          this.enter(room, true);
        });
      } else if (msg.type === 'ERROR') {
        this.signalingError(msg.reason);
      } else if (msg.type === 'WELCOME') {  //welcome to existing room
        let room = this.rooms.get(roomName);
        room.state.entered = "entered";
        msg.remotePeerIds.forEach((peerId: string) => {
          let peer = room.createPeer(peerId, peerId);
          if (peer && !peer.isConnected()) {
            let pc = this.askPeerConnection(roomName, peerId);
            this.doOffer(roomName, peerId, pc);
          }
        });
      } else if (msg.type === 'offer') {
        let peerId: string = msg.fromPeer;
        let peer = this.rooms.get(roomName).createPeer(peerId, peerId);
        if (peer && !peer.isConnected()) {
          let room = this.rooms.get(roomName);
          let pc = this.askPeerConnection(roomName, peerId);
          if (pc) {
            pc.setRemoteDescription(new RTCSessionDescription(msg))
              .then(() => {
                this.doAnswer(roomName, peerId, pc);
              })
              .catch(e => {
                if (room.onFailure) {
                  room.onFailure(peerId, e);
                } else {
                  console.log(e.name + "  " + e.message);
                }
              });
          }
        }
      } else if (msg.type === 'answer') {
        let room = this.rooms.get(roomName);
        let peer = room.getPeer(msg.fromPeer);
        if (peer && !peer.isConnected()) {
          let pc = peer.peerConnection;
          if (pc) {
            pc.setRemoteDescription(new RTCSessionDescription(msg))
              .catch(e => {
                if (room.onFailure) {
                  room.onFailure(msg.fromPeer, e);
                } else {
                  console.log(e.name + "  " + e.message);
                }
              });
          }
        }
      } else if (msg.type === 'candidate') {
        let room = this.rooms.get(roomName);
        let peer = room.getPeer(msg.fromPeer);
        let pc = peer.peerConnection;
        let candidate = new RTCIceCandidate({
          sdpMLineIndex: msg.label,
          candidate: msg.candidate
        });
        pc.addIceCandidate(candidate)
          .catch(e => {
            console.log("Failure during addIceCandidate(): " + e.name + "  " + e.message);
            if (room.onFailure) {
              room.onFailure(msg.fromPeer, e);
            }
          });

        //hack
        if (!peer['noNeedReconnect']) {
          setTimeout(() => {
            if (!peer.isConnected() && peer['connectionRole'] == "answer") {
              peer['noNeedReconnect'] = true;
              let pc = this.askPeerConnection(roomName, msg.fromPeer);
              this.doOffer(roomName, msg.fromPeer, pc);
            }
          }, 2500);
        }
        // } else if (msg.type === 'GETROOM') {
        //   this.room = msg.value;
        //   this.onRoomReceived(this.room);
        //   //printState("Room received");
      } else if (msg.type === 'WRONGROOM') {
        //window.location.href = "/";
        console.log("Wrong room");
      } else {
        this.signalingMessageAwaitings.forEach(f => f(msg));
      }
    }

    onSignalingChannelClosed() {
      this.signalingReady = false;
      this.$interval.cancel(this.pingSignalingInterval);
    }

    askPeerConnection(roomName: string, peerId: string) {
      let peer = this.rooms.get(roomName).getPeer(peerId);

      //that's rude. Should analyze the connection state and create a new one or use an existing
      let pc: RTCPeerConnection = peer.peerConnection;
      if (pc && pc.iceConnectionState != "connected") {
        pc.close();
        pc = null;
      }

      try {
        pc = new RTCPeerConnection(this.config);
        pc.onicecandidate = (event) => {
          if (event.candidate)
            this.sendSignalingMessage([{room: roomName, toPeerId: peerId}, {
              type: 'candidate',
              label: event.candidate.sdpMLineIndex,
              id: event.candidate.sdpMid,
              candidate: event.candidate.candidate
            }]);
        };
        pc.ondatachannel = (event) => {
          let dataChannel = event.channel;
          console.log('Received data channel creating request');  //calee do
          this.initDataChannel(roomName, peerId, dataChannel, true);
          console.log("init Data Channel");
          peer.dataChannel = dataChannel;
        };
        pc.oniceconnectionstatechange = (event: Event) => {
          if (pc.iceConnectionState == 'disconnected') {
            if (peer.dataChannel) {
              peer.dataChannel.close();
              this.onCloseDataChannel(roomName, peerId, peer.dataChannel);
            }
            console.log('Disconnected');
          }
        };

        peer.peerConnection = pc;

        return pc;
      } catch (e) {
        console.log(e);
        pc = null;
        return;
      }
    }

    initDataChannel(roomName: string, peerId: string, dataChannel: RTCDataChannel, sendCheckingMessage?: boolean) {
      dataChannel.onopen = (event) => this.onOpenDataChannel(roomName, peerId, dataChannel, sendCheckingMessage);
      dataChannel.onclose = (event) => this.onCloseDataChannel(roomName, peerId, dataChannel);
      dataChannel.onmessage = (event) => this.onMessage(roomName, peerId, dataChannel, event);
      this.rooms.get(roomName).getPeer(peerId).dataChannel = dataChannel;
      console.log(`initDataChannel ${roomName} ${peerId} ${dataChannel.label}`);
    }

    onOpenDataChannel(roomName: string, peerId: string, dataChannel: RTCDataChannel, sendCheckingMessage?: boolean) {
      if (sendCheckingMessage) {
        let checkChannelMessage = {type: P2PConnector.MSG_TYPE_CHECK_CHANNEL, room: roomName, value: ("" + Math.random())};
        //send checking message to signaling server,
        // then when other peer will send this value also the server will be sure that both ends established channel
        this.sendSignalingMessage([checkChannelMessage]);
        //send checking message to peer
        this.send(roomName, JSON.stringify(checkChannelMessage), dataChannel);
        console.log("Checking message sent " + checkChannelMessage.value);
      }

      let room: Room = this.rooms.get(roomName);
      if (room.onOpenDataChannel) {
        room.onOpenDataChannel(peerId);
      }
      room.getPeer(peerId).dataChannel = dataChannel;

      //request proof of identity - other party must respond by sending the data signed by its public key.
      //In request my party send own proof also.
      //For example, generate random data, sign it, send signed data to other party, the other party signs the data and sends it back
      let dataHex = converters.stringToHexString(randomString());
      if (!room["proofData"])
        room["proofData"] = {};
      room["proofData"][peerId] = dataHex;
      let signedData = this.sign(dataHex);
      let proofRequest = {type: P2PConnector.MSG_TYPE_REQUEST_PROOF_IDENTITY,
        signature: signedData.signatureHex, data: signedData.dataHex, publicKey: signedData.publicKeyHex};
      this.send(roomName, JSON.stringify(proofRequest), dataChannel);

      console.log(`Data channel is opened ${dataChannel.label}`);
    }

    onCloseDataChannel(roomName: string, peerId: string, dataChannel: RTCDataChannel) {
      console.log(`onCloseDataChannel ${roomName} ${peerId}`);
      let room: Room = this.rooms.get(roomName);

      room.getPeer(peerId).dataChannel = null;

      // if (dataChannels.length == 0)
      //   delete this.rooms[roomName];

      //commented out because websocket somewhy does not open on the next request
      // if (Object.keys(this.rooms).length == 0)
      //   if (this.signalingChannel)
      //     this.signalingChannel.close();

      if (room && room.onCloseDataChannel)
        room.onCloseDataChannel(peerId);
    }

    createDataChannel(room: string, peerId: string, peerConnection: RTCPeerConnection, role) {
      let dataChannel: RTCDataChannel;
      try {
        dataChannel = peerConnection.createDataChannel(room + ":" + peerId, null);  //caller do
      } catch (e) {
        console.log('error creating data channel ' + e);
        return;
      }
      this.initDataChannel(room, peerId, dataChannel);
    }

    onFailure(roomName: string, peerId: string, e) {
      let room: Room = this.rooms.get(roomName);
      if (room.onFailure)
        room.onFailure(peerId, e);
    }

    /**
     * offer example:
     * [
     * {"room":"1", "toPeerId":"93ac1cc5f78d3c54da74282dfb5012a2f29b5310b52bea5288f147f31a361419"},
     * {"type":"offer", "sdp":"v=0\r\no=- 199179691613427 ... webrtc-datachannel 1024\r\n"}
     * ]
     */
    doOffer(roomName: string, peerId: string, peerConnection: RTCPeerConnection) {
      console.log("do offer");
      let peer = this.rooms.get(roomName).getPeer(peerId);
      peer['connectionRole'] = 'offer';
      this.createDataChannel(roomName, peerId, peerConnection, "caller");
      peerConnection.createOffer((offer) => {
          peerConnection.setLocalDescription(offer, () => {
            this.sendSignalingMessage([{room: roomName, "toPeerId": peerId}, peerConnection.localDescription]);
          }, (e) => this.onFailure(roomName, peerId, e));
        }, (e) => this.onFailure(roomName, peerId, e),
        null);
    }

    /**
     * answer example:
     * [
     * {"room":"1", "toPeerId":"12a26b3d6c17395f787166254b50259075fa0649ef0045ebd0c1555c4c5d8462"},
     * {"type":"answer", "sdp":"v=0\r\no=- 6490594091461 ... webrtc-datachannel 1024\r\n"}
     * ]
     */
    doAnswer(roomName: string, peerId: string, peerConnection: RTCPeerConnection) {
      console.log("do answer");
      let peer = this.rooms.get(roomName).getPeer(peerId);
      peer['connectionRole'] = peer['connectionRole'] ? 'no need' : 'answer';
      peerConnection.createAnswer((answer) => {
        peerConnection.setLocalDescription(answer, () => {
          this.sendSignalingMessage([{room: roomName, toPeerId: peerId}, peerConnection.localDescription]);
        }, (e) => this.onFailure(roomName, peerId, e));
      }, (e) => this.onFailure(roomName, peerId, e));
    }

    // onChannelStateChange(dataChannel) {
    //   console.log('Data channel state is: ' + dataChannel.readyState);
    // }

    /**
     * Sends message to all online members of room.
     */
    sendMessage(roomName: string, message: P2PMessage) {
      return this.send(roomName, JSON.stringify(message));
    }

    private send(roomName: string, data, channel?: RTCDataChannel) {
      if (channel) {
        return this.sendInternal(channel, data);
      } else {
        let count = 0;
        if (roomName && this.rooms.get(roomName)) {
          this.rooms.get(roomName).getDataChannels().forEach(channel => count = count + this.sendInternal(channel, data));
        }
        return count;
      }
    }

    private sendInternal(channel: RTCDataChannel, data): number {
      let notSentReason;
      if (channel.readyState == "open") {
        try {
          channel.send(data);
          console.log(`>>> channel ${channel.label} \n ${data}`);
          return 1;
        } catch (e) {
          notSentReason = e.toString();
        }
      } else {
        notSentReason = "Channel state " + channel.readyState;
      }
      if (notSentReason) {
        console.log("Not sent: " + notSentReason);
      }
      return 0;
    }

    onMessage(roomName: string, peerId: string, dataChannel: RTCDataChannel, event: MessageEvent) {
      try {
        let msg = JSON.parse(event.data);

        let room: Room = this.rooms.get(roomName);
        if (room) {
          msg.fromPeerId = peerId;
          msg.roomName = roomName;
          room.onMessageInternal(msg);
        }
        console.log(`<<< channel ${dataChannel.label} \n ${event.data}`);
        if (msg.type === P2PConnector.MSG_TYPE_CHECK_CHANNEL) {
          this.sendSignalingMessage([{room: roomName}, msg]);
          //console.log("CHECK_CHANNEL " + msg.txt);
          //console.log("Checking message received (then sent to signaling server) " + msg.value);
        } else if (msg.type === P2PConnector.MSG_TYPE_REQUEST_PROOF_IDENTITY) {
          let signedData = this.sign(msg.data);
          let response = {type: P2PConnector.MSG_TYPE_RESPONSE_PROOF_IDENTITY,
            signature: signedData.signatureHex, data: signedData.dataHex, publicKey: signedData.publicKeyHex};
          this.send(roomName, JSON.stringify(response), dataChannel);
        } else if (msg.type === P2PConnector.MSG_TYPE_RESPONSE_PROOF_IDENTITY) {
          if (msg.rejected) {
            if (room.onRejected) {
              room.onRejected(peerId, msg.rejected);
            }
            console.log(`Peer ${peerId} rejected channel to him`);
            dataChannel.close();
            return;
          }
          let rejectedReason;
          if (room["proofData"][peerId] !== msg.data) {
            rejectedReason = "Received data does not match the sent data";
          } else if (msg.publicKey !== peerId) {
            rejectedReason = "Received public key does not match the peer's public key";
          } else if (room.memberPublicKeys.indexOf(msg.publicKey) == -1) {
            rejectedReason = "Received public key is not allowed";
          }
          if (rejectedReason) {
            let response = {type: P2PConnector.MSG_TYPE_RESPONSE_PROOF_IDENTITY, rejected: rejectedReason};
            this.send(roomName, JSON.stringify(response), dataChannel);
            dataChannel.close();
            return;
          }
          if (heat.crypto.verifyBytes(msg.signature, msg.data, msg.publicKey)) {
            delete room["proofData"][peerId];
            console.log("PROOF_IDENTITY ok: \n" + msg.signature + " " +  msg.data + " " + msg.publicKey);
            if (!room.provenPublicKeyAllowed(room, peerId, msg.publicKey)) {
              let response = {type: P2PConnector.MSG_TYPE_RESPONSE_PROOF_IDENTITY, rejected: "Public key owner is not allowed to connect"};
              this.send(roomName, JSON.stringify(response), dataChannel);
              dataChannel.close();
            }
          } else {
            let response = {type: P2PConnector.MSG_TYPE_REQUEST_PROOF_IDENTITY, rejected: "Invalid signature"};
            this.send(roomName, JSON.stringify(response), dataChannel);
            dataChannel.close();
          }
        }
      } catch (e) {
        console.log(e);
      }
    }

    /**
     * Close all data channels for the room, delete the room.
     */
    closeRoom(room: Room) {
      let dataChannels = room.getDataChannels();
      dataChannels.forEach(channel => channel.close());

      //room deleting is in the onCloseDataChannel()
    }

    /**
     * Clear all data. Close websocket of signaling channel.
     */
    close() {
      this.identity = null;
      this.pendingIdentity = null;
      this.pendingRooms = [];
      this.pendingOnlineStatus = null;
      this.rooms.forEach(room => this.closeRoom(room));
      if (this.signalingReady) {
        this.getWebSocket().then(socket => socket.close());
      }
    }


    private request(request: () => void, handleResponse: (msg) => any): Promise<any> {
      let p = new Promise<any>((resolve, reject) => {
        let f = (msg) => {
          let v = handleResponse(msg);
          if (v !== this.notAcceptedResponse) {
            resolve(v);
            let i: number = this.signalingMessageAwaitings.indexOf(f);
            if (i !== -1)
              this.signalingMessageAwaitings.splice(i, 1);
          }
        };
        this.signalingMessageAwaitings.push(f);
        return request();
      });
      return promiseTimeout(3000, p);
    }

  }

  function promiseTimeout(ms, promise) {
    return new Promise(function (resolve, reject) {
      // create a timeout to reject promise if not resolved
      var timer = setTimeout(function () {
        reject(new Error("promise timeout"));
      }, ms);

      promise
        .then(function (res) {
          clearTimeout(timer);
          resolve(res);
        })
        .catch(function (err) {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  function randomString() {
    return Math.random().toString(36).substr(2);
  }

}
