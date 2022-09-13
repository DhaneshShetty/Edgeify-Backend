const express = require("express");
const app = express();
const cors = require("cors");
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cannyEdgeDetector = require("canny-edge-detector");
const {Image}= require('image-js');
const {getDatabase,set} = require('firebase/database');
const reff = require('firebase/database').ref;
const {getStorage,getDownloadURL,ref,uploadBytes} = require('firebase/storage');
const {firebaseApp} = require('./config.js');
const fsExtra = require('fs-extra');


app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(cors());
const database = getDatabase(firebaseApp);
const cloudStorage = getStorage(firebaseApp);

async function uploadLinksToRDB(org,ed){
    try{
    set(reff(database, 'images/'+Date.now()), {
        org_img: org,
        edge_img: ed
      });
    return true;
    }
    catch(ex){
        console.log(ex);
    }    
}

async function uploadImageToStorage(file,name){
    const storageRef = ref(cloudStorage, name);
    const metadata = {
        contentType: file.mimeType,
    };
    const snap=await uploadBytes(storageRef, file);
    const url= await getDownloadURL(storageRef);
    return url;
}

const storage = multer.diskStorage({
    destination: function(req,file,cb){
        cb(null,'./tmp/uploads')
    },
    filename:function(req,file,cb){
        const uSuff = Date.now()+'-'+Math.random(Math.random()*1E9)+".png"
        cb(null,file.originalname+'-'+uSuff)
    }
})

const upload = multer({storage:storage})

app.post('/process',upload.single('img'),async function(req,res){
    try{
        console.log(req);
    let file = req.file;
    Image.load('tmp/uploads/'+file.filename).then((img)=>{
        const grey = img.grey();
        const edge = cannyEdgeDetector(grey);
        edge.save('tmp/uploads/'+file.filename+"-edge.png");
    })
    const link1 = await uploadImageToStorage(fs.readFileSync(path.join('tmp/uploads/' + req.file.filename)),file.filename);
    const link2 = await uploadImageToStorage(fs.readFileSync(path.join('tmp/uploads/' + req.file.filename+"-edge.png")),file.filename+"-edge.png");
    const stored= await uploadLinksToRDB(link1,link2);    
    fsExtra.emptyDirSync('./tmp/uploads/');
    return res.status(200).json({success:true,original:link1,edged:link2});
    }  
    catch(ex){
        return res.status(500).json({success:false,error:ex.message})
    }
})

app.listen(5000,()=>{
    console.log("Server running at port 5000");
})
