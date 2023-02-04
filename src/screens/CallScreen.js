import { useParams } from "react-router-dom";
import { useRef, useEffect,useState } from "react";
import socketio from "socket.io-client";
import "./CallScreen.css";

function CallScreen() {
  const params = useParams();
  const localUsername = params.username;
  const roomName = params.room;
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);

//ec2-54-168-239-171.ap-northeast-1.compute.amazonaws.com
  // const socketUrl ="http://localhost:5004/";
  const socketUrl ="ec2-54-168-239-171.ap-northeast-1.compute.amazonaws.com:8080";
  const socket = socketio(socketUrl, {
    autoConnect: false,
  });

  let pc; // For RTCPeerConnection Object

  const sendData = (data) => {
    socket.emit("data", {
      username: localUsername,
      room: roomName,
      data: data,
    });
  };

  const startConnection = () => {
    navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: {
          height: 350,
          width: 350,
        },
      })
      .then((stream) => {
        console.log("Local Stream found");
        localVideoRef.current.srcObject = stream;
        socket.connect();
        socket.emit("join", { username: localUsername, room: roomName });
      })
      .catch((error) => {
        console.error("Stream not found: ", error);
      });
  };

  const onIceCandidate = (event) => {
    if (event.candidate) {
      console.log("Sending ICE candidate");
      sendData({
        type: "candidate",
        candidate: event.candidate,
      });
    }
  };

  const onTrack = (event) => {
    console.log("Adding remote track");
    remoteVideoRef.current.srcObject = event.streams[0];
  };

  const createPeerConnection = () => {
    try {
      pc = new RTCPeerConnection({
        iceServers: [
            {
              urls: "stun:relay.metered.ca:80",
            },
            {
              urls: "turn:relay.metered.ca:80",
              username: "256079649c3e90bd20a02c12",
              credential: "oh6jc4Vvzp5c3It6",
            },
            {
              urls: "turn:relay.metered.ca:443",
              username: "256079649c3e90bd20a02c12",
              credential: "oh6jc4Vvzp5c3It6",
            },
            {
              urls: "turn:relay.metered.ca:443?transport=tcp",
              username: "256079649c3e90bd20a02c12",
              credential: "oh6jc4Vvzp5c3It6",
            },
        ],
      });
      pc.onicecandidate = onIceCandidate;
      pc.ontrack = onTrack;
      const localStream = localVideoRef.current.srcObject;
      for (const track of localStream.getTracks()) {
        pc.addTrack(track, localStream);
      }
      console.log("PeerConnection created");
    } catch (error) {
      console.error("PeerConnection failed: ", error);
    }
  };

  const setAndSendLocalDescription = (sessionDescription) => {
    pc.setLocalDescription(sessionDescription);
    console.log("Local description set");
    sendData(sessionDescription);
  };

  const sendOffer = () => {
    console.log("Sending offer");
    pc.createOffer().then(setAndSendLocalDescription, (error) => {
      console.error("Send offer failed: ", error);
    });
  };

  const sendAnswer = () => {
    console.log("Sending answer");
    pc.createAnswer().then(setAndSendLocalDescription, (error) => {
      console.error("Send answer failed: ", error);
    });
  };

  const signalingDataHandler = (data) => {
    if (data.type === "offer") {
      createPeerConnection();
      pc.setRemoteDescription(new RTCSessionDescription(data));
      sendAnswer();
    } else if (data.type === "answer") {
      pc.setRemoteDescription(new RTCSessionDescription(data));
    } else if (data.type === "candidate") {
      pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    } else {
      console.log("Unknown Data");
    }
  };
  const handleSubmit = () => {
    console.log("submit:"+message)
    if (!message) {
      return;
    }
    socket.connect();
    socket.emit("datamsg", {roomname:roomName,msg:message,user:localUsername});
    setMessage("");
  };


  const handleText = (e) => {
    const inputMessage = e.target.value;
    setMessage(inputMessage);
  };


  socket.on("ready", () => {
    console.log("Ready to Connect!");
    createPeerConnection();
    sendOffer();
  });

  socket.on("data", (data) => {
    console.log("Data received: ", data);
    signalingDataHandler(data);
  });

  useEffect(() => {
    socket.on("datamsg", (data) => {
      console.log("messages: ",messages);
      // let newarray =messages
      setMessages(messages=>[...messages, data.data]);
      
    });
    return () => {
      socket.off("datamsg", () => {
        console.log("data event was removed");
      });
    };
  }, [socket, messages]);


  useEffect(() => {
    startConnection();
    return function cleanup() {
      pc?.close();
    };
  }, []);

  return (
    <div>
      <label>{"Username: " + localUsername}</label>
      <label>{"Room Id: " + roomName}</label>
      <video autoPlay muted playsInline ref={localVideoRef} />
      <video autoPlay muted playsInline ref={remoteVideoRef} />
      <div>
        <h2>Chat</h2>
        <input type="text" value={message} onChange={handleText} />
        <button onClick={handleSubmit}>submit</button>
        <ul>
          {messages.map((message, ind) => {
            return <li key={ind}>{ind+' '+message}</li>;
          })}
        </ul>
      
      </div>
    </div>
  );
}

export default CallScreen;
