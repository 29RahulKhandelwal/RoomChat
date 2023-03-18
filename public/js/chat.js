const socket=io();
var audio=new Audio("/Sounds/ding.mp3");
const{username,room}=Qs.parse(location.search,{ignoreQueryPrefix:true});
console.log(username);
console.log(room);
const chatContainer = document.querySelector("#messages");
const autoscroll=()=>{
    chatContainer.scrollTop = chatContainer.scrollHeight;
}
socket.on("admin-message",(message)=>{
    console.log(message);
    const html=Mustache.render($("#admin-message-template").text(),{
        message:message.text,
        createdAt:moment(message.createdAt).format('h:mm a')
    });
    $("#messages").append(html);
    autoscroll();
});
socket.on("receiveMessage",(message)=>{
    console.log(message);
    const html=Mustache.render($("#receive-message-template").text(),{
        username:message.username,
        message:message.text,
        createdAt:moment(message.createdAt).format('h:mm a')
    });
    $("#messages").append(html);
    audio.play();
    autoscroll();
});
socket.on("receiveLocationMessage",(message)=>{
    console.log(message);
    const html=Mustache.render($("#receive-location-message-template").text(),{
        username:message.username,
        url:message.url,
        createdAt:moment(message.createdAt).format('h:mm a')
    });
    $("#messages").append(html);
    audio.play();
    autoscroll();
});
socket.on('roomData',({room,users})=>{
    const html=Mustache.render(document.querySelector('#sidebar-template').innerHTML,{
        room,
        users
    })
    document.querySelector('#sidebar').innerHTML=html;
    let sidebar = document.querySelector(".sidebar");
    let closeBtn = document.getElementById("btn");
    let userBtn = document.getElementById("user");
    let joinRoom = document.getElementById("joinRoom");
    let logout = document.getElementById("logout");
    
    sidebar.classList.toggle("open");
    menuBtnChange();
    
    closeBtn.addEventListener("click", (e)=>{
        sidebar.classList.toggle("open");
        menuBtnChange();
    });
    
    userBtn.addEventListener("click", (e)=>{
        sidebar.classList.toggle("open");
        menuBtnChange();
    });
    
    joinRoom.addEventListener("click", (e)=>{
        sidebar.classList.toggle("open");
        menuBtnChange();
    });
    logout.addEventListener("click", (e)=>{
        sidebar.classList.toggle("open");
        menuBtnChange();
    });
    
    function menuBtnChange() {
        if(sidebar.classList.contains("open")){
            closeBtn.classList.replace("bx-menu", "bx-menu-alt-right");
            logout.style.width="225px";
            joinRoom.style.width="225px";
            
            var x=document.querySelectorAll(".parahide");
            for(var i=0;i<x.length;i++){
                x[i].style.visibility="visible";
            }
        }
        else {
            closeBtn.classList.replace("bx-menu-alt-right","bx-menu");
            logout.style.width="78px";
            joinRoom.style.width="78px";
            
            var x=document.querySelectorAll(".parahide");
            for(var i=0;i<x.length;i++){
                x[i].style.visibility="hidden";
            }
        }
    }
    autoscroll();
});
$('#message-form').on('submit',(e)=>{
    e.preventDefault();
    $("button").attr('disabled','disabled');
    const message=e.target.elements.message.value;
    const html=Mustache.render($("#send-message-template").text(),{
        username:"You",
        message:message,
        createdAt:moment(message.createdAt).format('h:mm a')
    });
    $("#messages").append(html);
    autoscroll();
    socket.emit('sendMessage',message,(err)=>{
        $("button").removeAttr('disabled');
        $("input").val('');
        $("input").focus();
        if(err){
            return console.log(err);
        }else{
            console.log("The message has been delivered!");
        }
    });
});
$('#send-location').on('click',()=>{
    if(!navigator.geolocation){
        return alert('Geolocation is not supported by your browser');
    }
    $("#send-location").attr("disabled","disabled");
    navigator.geolocation.getCurrentPosition((position)=>{
        const url=`https://www.google.com/maps?q=${position.coords.latitude},${position.coords.longitude}`;
            const html=Mustache.render($("#send-location-message-template").text(),{
                username:"You",
                url:url,
                createdAt:moment(url.createdAt).format('h:mm a')
            });
            $("#messages").append(html);
            autoscroll();
        socket.emit('sendLocation',{
            latitude:position.coords.latitude,
            longitude:position.coords.longitude
        },()=>{
            $("#send-location").removeAttr("disabled");
            console.log("Location Shared!"); 
        });
    });
});

socket.emit('join', { username, room }, (error) => {
    if (error) {
        alert(error)
        location.href = '/joinroom'
    }
})
