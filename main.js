let APP_ID = "5127b42c121d4001a2127896529d950a";
let token = null;
let uid = String(Math.floor(Math.random() * 10000));

let client;
let channel;

let queryString = window.location.search
let urlParams = new URLSearchParams(queryString)
let roomId = urlParams.get('room')

if (!roomId) {
    window.location = 'lobby.html'
}

let localStream;
let remoteStream;
let peerConnection;

const configuration = {
    iceServers: [
        {
            urls: [
                'stun:stun1.l.google.com:19302',
                'stun:stun2.l.google.com:19302'
            ]
        }
    ]
}

let constrains = {
    video: {
        widht: { min: 640, ideal: 1920, max: 1920 },
        height: { min: 480, ideal: 1080, max: 1080 },
    },
    audio: true,
}

let init = async () => {

    client = await AgoraRTM.createInstance(APP_ID)
    await client.login({ uid, token })

    channel = client.createChannel(roomId)
    await channel.join()


    channel.on('MemberJoined', handleUserJoined)
    channel.on('MemberLeft', handleUserLeft)
    client.on('MessageFromPeer', handleMessageFromPeer)

    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    document.getElementById('user-1').srcObject = localStream


}

let handleUserJoined = async (MemberId) => {
    console.log("A new user joined the channel:", MemberId)
    createOffer(MemberId);
}

let handleUserLeft = async (MemberId) => {
    document.getElementById('user-2').style.display = 'none'
    document.getElementById('user-1').classList.remove('smallFrame')
}

let handleMessageFromPeer = async (message, MemberId) => {
    message = JSON.parse(message.text)

    if (message.type === 'answer') {
        addAnswer(message.answer)
    }

    if (message.type === 'offer') {
        createAnswer(MemberId, message.offer)
    }

    if (message.type === 'candidate') {
        if (peerConnection) {
            peerConnection.addIceCandidate(message.candidate)
        }
    }

    console.log("Message: ", message)
}

let createPeerConnection = async (MemberId) => {
    peerConnection = new RTCPeerConnection(configuration);

    //rezerwacaja MediaStreamu dla kogos kto sie kiedys podlaczy.
    remoteStream = new MediaStream()
    document.getElementById('user-2').srcObject = remoteStream
    document.getElementById('user-2').style.display = 'block'

    document.getElementById('user-1').classList.add('smallFrame')


    if (!localStream) {
        localStream = await navigator.mediaDevices.getUserMedia({ constrains })
        document.getElementById('user-1').srcObject = localStream
    }

    //rejestrujemy wszystkie nasze traki i dodajemy do naszego streama
    localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream)
    })

    // dodajemy event za kazdym razem jak sie pojawi nowy track (a nowy pojawia sie od remota. Bo lokalnie sami to kontrolujemy) to dodajemy go do remoteStreamu
    peerConnection.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
            remoteStream.addTrack(track);
        })
    }

    // Tutaj dostajemy zwrotki o IceCandidates (naszych... chyba) ktore potem wyslemy do remote.
    peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
            client.sendMessageToPeer({ text: JSON.stringify({ 'type': 'candidate', 'candidate': event.candidate }) }, MemberId)
        }
    }

}

let createOffer = async (MemberId) => {

    await createPeerConnection(MemberId)

    //Stworzenie oferty
    let offer = await peerConnection.createOffer()
    await peerConnection.setLocalDescription(offer)

    client.sendMessageToPeer({ text: JSON.stringify({ 'type': 'offer', 'offer': offer }) }, MemberId)
    console.log('Offer:', offer)

}

let createAnswer = async (MemberId, offer) => {
    await createPeerConnection(MemberId)

    await peerConnection.setRemoteDescription(offer)

    let answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer)

    client.sendMessageToPeer({ text: JSON.stringify({ 'type': 'answer', 'answer': answer }) }, MemberId)

}

let addAnswer = async (answer) => {
    if (!peerConnection.currentRemoteDescirption) {
        peerConnection.setRemoteDescription(answer)
    }
}

let leaveChannel = async () => {
    await channel.leave()
    await client.logout()
}

let toggleCamera = async () => {
    let videoTrack = localStream.getTracks().find(track => track.kind === 'video')
    if (videoTrack.enabled) {
        videoTrack.enabled = false
        document.getElementById('camera-btn').style.backgroundColor = 'rgb(255,80,80)'
    }
    else {
        videoTrack.enabled = true;
        document.getElementById('camera-btn').style.backgroundColor = 'rgb(179,102,249,.9)'

    }
}

let toggleMic = async () => {
    let audioTrack = localStream.getTracks().find(track => track.kind === 'audio')
    if (audioTrack.enabled) {
        audioTrack.enabled = false
        document.getElementById('mic-btn').style.backgroundColor = 'rgb(255,80,80)'
    }
    else {
        audioTrack.enabled = true;
        document.getElementById('mic-btn').style.backgroundColor = 'rgb(179,102,249,.9)'

    }
}

document.getElementById('camera-btn').addEventListener('click', toggleCamera)
document.getElementById('mic-btn').addEventListener('click', toggleMic)


window.addEventListener('beforeunload', leaveChannel)

init()
