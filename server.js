const express=require("express");
const Razorpay=require("razorpay");
const path=require("path");
require("dotenv").config();
const app=express();
app.use(express.json());
app.use(express.static(path.join(__dirname,"public")));

const razorpay=(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
 ? new Razorpay({key_id:process.env.RAZORPAY_KEY_ID,key_secret:process.env.RAZORPAY_KEY_SECRET}) : null;

app.get("/api/config",(req,res)=>res.json({keyId:process.env.RAZORPAY_KEY_ID||null}));
app.post("/api/create-order",async(req,res)=>{
 try{
   if(!razorpay) return res.status(503).json({error:"Razorpay is not configured yet."});
   const amount=Math.max(100,Math.round(Number(req.body.amount||0)*100));
   if(!amount) return res.status(400).json({error:"Invalid amount"});
   const order=await razorpay.orders.create({amount,currency:"INR",receipt:"comp_"+Date.now()});
   res.json(order);
 }catch(e){res.status(500).json({error:e.message});}
});
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(process.env.PORT||3000,()=>console.log("Companio running"));
