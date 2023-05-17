let APP_ID = "0552b38e27134d079c0c8c808805da95"
let token = null;
let uid = String(Math.floor(Math.random() * 10000));

let client; //ogin user
let channel; ///one medium when users are join

//////  Get the room id by url
let queryString = window.location.search
let urlParams = new URLSearchParams(queryString);
let roomId = urlParams.get('room');

if (!roomId) {
    window.location = 'lobby.html';
}

// for local access
let localStream;
// for remote access
let remoteStream;
// create peer variable
let peerConnection;


// this server setup for production locally is working but for production server need
const servers = {
    iceServers: [
        {
            urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302']
        }
    ]
}

//// declare a function when page load
let init = async () => {

    //// Creating the instance of agora
    client = await AgoraRTM.createInstance(APP_ID);
    /// When user login then automatic socket establise anduser setup
    await client.login({ uid, token });
    /// Here we are creating the channel thats name is 'main' 
    channel = client.createChannel(roomId);
    /// Here we are joining the channel
    await channel.join();

    ///for this event lister we are joined the member
    // Many of members are join the channel then we are send the message
    channel.on('MemberJoined', handleUserJoined);

    //// When member left the meeting then we are run the code
    channel.on('MemberLeft', handleUserLeft);

    ///for this  event listener we get the message when  new user are join the  channel
    client.on("MessageFromPeer", handleMessageFromPeer)

    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById("user-1").srcObject = localStream;

}

let handleUserLeft = (MemberId) => {
    document.getElementById('user-2').style.display = "none"
    document.getElementById("user-1").classList.remove('smallFrame');
}

/////Handle message function
let handleMessageFromPeer = async (message, MemberId) => {
    message = JSON.parse(message.text);
    if (message.type === "offer") {
        createAnswer(MemberId, message.offer)
    }
    if (message.type === "answer") {
        addAnswer(message.answer)
    }

    if (message.type === "candidate") {
        if (peerConnection) {
            peerConnection.addIceCandidate(message.candidate)
        }
    }

}

let handleUserJoined = async (MemberId) => {
    console.log("A new user joined the channel", MemberId);
    createOffer(MemberId);
}


////// Create peer connection
let createPeerConnection = async (MemberId) => {

    ///////// peer connection object declear
    peerConnection = new RTCPeerConnection(servers);
    //////// get the reciver media
    remoteStream = new MediaStream();
    document.getElementById("user-2").srcObject = remoteStream;
    document.getElementById("user-2").style.display = "block";

    document.getElementById("user-1").classList.add('smallFrame');


    if (!localStream) {
        localStream = await navigator.mediaDevices.getUserMedia(
            { video: true, audio: true }
        );
        document.getElementById("user-1").srcObject = localStream;
    }


    localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream)
    })

    peerConnection.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
            remoteStream.addTrack(track);
        })
    }

    //////////when user join the link then one candidate token generate and  send message by agoda which are using socket.io
    peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
            client.sendMessageToPeer({ text: JSON.stringify({ 'type': 'candidate', 'candidate': event.candidate }) }, MemberId)
        }
    }

}

////// Creating the offer
let createOffer = async (MemberId) => {
    /////// Here we are call the create offer function then 
    /////// contain the all loginof creting the offers
    await createPeerConnection(MemberId)
    //  Create a offer
    let offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    /////Send message when new user join  
    client.sendMessageToPeer(
        {
            text: JSON.stringify({ 'type': "offer", 'offer': offer })
        },
        MemberId
    );
}


//////Creating a answer
let createAnswer = async (MemberId, offer) => {
    ////////call the creating offer function
    await createPeerConnection(MemberId);
    await peerConnection.setRemoteDescription(offer);
    let answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    client.sendMessageToPeer({
        text: JSON.stringify({
            'type': "answer",
            'answer': answer
        })
    }, MemberId);
}


////// Add answer
let addAnswer = async (answer) => {
    if (!peerConnection.currentRemoteDescription) {
        peerConnection.setRemoteDescription(answer);
    }
}

////// When user leave the channel then code execute
let leaveChannel = async () => {
    await channel.leave();
    await client.logout();
}


//// toggle the camera  button
let toggleCamera = async () => {
    //Here get the video track
    let videoTrack = localStream.getTracks().find(track => track.kind === 'video');
    if (videoTrack.enabled) {
        videoTrack.enabled = false;
        document.getElementById('camera-btn').style.backgroundColor = 'rgb(255 ,80, 80)'
    } else {
        videoTrack.enabled = true;
        document.getElementById('camera-btn').style.backgroundColor = 'rgb(179 ,102, 249 ,.9)'
    }

}

//// toggle the mic  button
let toggleMic = async () => {
    //Here get the video track
    let audioTrack = localStream.getTracks().find(track => track.kind === 'audio');
    if (audioTrack.enabled) {
        audioTrack.enabled = false;
        document.getElementById('mic-btn').style.backgroundColor = 'rgb(255 ,80, 80)'
    } else {
        audioTrack.enabled = true;
        document.getElementById('mic-btn').style.backgroundColor = 'rgb(179 ,102, 249 ,.9)'
    }

}



window.addEventListener('beforeunload', leaveChannel);


//// when  click on the camera button then get the event listiner
document.getElementById('camera-btn').addEventListener('click', toggleCamera);

//// When click on  the mic butoon then get the event listiner
document.getElementById('mic-btn').addEventListener('click', toggleMic);

init();