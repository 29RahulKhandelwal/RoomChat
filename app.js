require("dotenv").config();
const express=require("express");
const ejs=require("ejs");
const mongoose=require("mongoose");
const session=require("express-session");
const passport=require("passport");
const passportLocalMongoose=require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate=require("mongoose-findorcreate");
const FacebookStrategy = require('passport-facebook').Strategy;
const http=require("http");
const socketio=require("socket.io");
const Filter=require("bad-words");
const {generateAdminMessage,generateMessage,generateLocationMessage}=require("./module");
const{addUser,removeUser,getUser,getUsersInRoom}=require('./users');

const app=express();

const server=http.createServer(app);
const io=socketio(server);

app.set("view engine","ejs");
app.use(express.static("public"));
app.use(express.urlencoded({extended:true}));

app.use(session({
    secret:process.env.Secret,
    resave:false,
    saveUninitialized:false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb+srv://admin-starchamp:Mongo@Db123@cluster0.ddncm.mongodb.net/chat",{useNewUrlParser:true,useUnifiedTopology:true});
mongoose.set("useCreateIndex",true);

const userSchema=new mongoose.Schema({
    username:String,
    name:String,
    password:String,
    googleId:String,
    googleDisplayName:String,
    facebookId:String,
    facebookDisplayName:String,
    secret:String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User=mongoose.model("User",userSchema);


passport.use(User.createStrategy());
passport.serializeUser(function(User, done) {
    done(null, User.id);
});
  
passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, User) {
      done(err, User);
    });
});

passport.use(new GoogleStrategy({
    clientID: process.env.Client_Id,
    clientSecret: process.env.Client_Secret,
    // callbackURL: "http://localhost:3000/auth/google/joinroom",
    callbackURL: "https://real-time-room-chat-app.herokuapp.com/auth/google/joinroom",
    userProfileURL:"https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
      console.log(profile);
    User.findOrCreate({name: profile.displayName, username:profile.emails[0].value , googleId: profile.id}, function (err, user) {
      return cb(err, user);
    });
  }
));
passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret:process.env.FACEBOOK_APP_SECRET,
    // callbackURL: "http://localhost:3000/auth/facebook/joinroom",
    callbackURL: "https://real-time-room-chat-app.herokuapp.com/auth/facebook/joinroom",
  },
  function(accessToken, refreshToken, profile, cb) {
      console.log(profile);
    User.findOrCreate({ facebookId: profile.id , username:profile.emails , facebookDisplayName:profile.displayName }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get("/",function(req,res){
    res.render("login");
});

app.get('/auth/google',
    passport.authenticate('google', { scope: ["profile","email"] })
);

app.get("/auth/google/joinroom", 
  passport.authenticate('google', { failureRedirect: '/' }),
  function(req, res) {
    res.redirect('/joinroom');
});

app.get('/auth/facebook',
  passport.authenticate('facebook',{ scope: ["email"] }));

app.get('/auth/facebook/joinroom',
  passport.authenticate('facebook', { failureRedirect: '/' }),
  function(req, res) {
    res.redirect('/joinroom');
});
app.get("/signup",function(req,res){
    res.render("signup");
});
app.get("/joinroom",function(req,res){
    if(req.isAuthenticated()){
        res.render("joinroom",{name:req.user.name,fbname:req.user.facebookDisplayName});
    }else{
        res.redirect("/");
    }
});
app.get("/chat",function(req,res){
    if(req.isAuthenticated()){
        res.render("chat");
    }else{
        res.redirect("/");
    }
});
app.get("/logout",function(req,res){
    req.logOut();
    res.redirect("/");
});
app.post("/signup",function(req,res){
    User.register({username:req.body.username,name:req.body.name},req.body.password,function(err,user){
        if(err){
            console.log(err);
            res.redirect("/signup");
        }else{
            passport.authenticate("local")(req,res,function(){
                res.redirect("/joinroom");
            });
        }
    });
});
app.post("/",function(req,res){
    const user=new User({
        username:req.body.username,
        password:req.body.password
    });
    req.login(user,function(err){
        if(err){
            console.log(err);
        }else{
            passport.authenticate("local",{ successRedirect: '/joinroom',
            failureRedirect: '/' })(req,res,function(){
                res.redirect("/joinroom");
            });
        }
    });
});

io.on("connection",(socket)=>{
    console.log("connected");
    socket.on('join',(options,callback)=>{
        const{error,user}=addUser({id:socket.id,...options});

        if(error){
            return callback(error)
        }

        socket.join(user.room);
        socket.emit("admin-message",generateAdminMessage('Welcome!'));
        socket.broadcast.to(user.room).emit('admin-message',generateAdminMessage(`${user.username} joined the chat!`));
        io.to(user.room).emit('roomData',{
            room:user.room,
            users:getUsersInRoom(user.room)
        })
        callback();
    });
    socket.on('sendMessage',(message,callback)=>{
        const user=getUser(socket.id);
        const filter=new Filter();
        if(filter.isProfane(message)){
            return callback("Profanity not allowed");
        }
        socket.to(user.room).emit('receiveMessage',generateMessage(user.username,message));
        callback(); 
    });
    socket.on('sendLocation',(coords,callback)=>{
        const user=getUser(socket.id)
        socket.to(user.room).emit('receiveLocationMessage',generateLocationMessage(user.username,`https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`));
        callback();
    });
    socket.on('disconnect',()=>{    
        const user=removeUser(socket.id);
        if(user){
            socket.broadcast.to(user.room).emit('admin-message',generateAdminMessage(`${user.username} left the chat!`));
            io.to(user.room).emit('roomData',{
                room:user.room,
                users:getUsersInRoom(user.room)
            })
        }
    });
});

const port=process.env.PORT || 3000;
server.listen(port,function(){
    console.log(`Server started on port ${port}`);
});