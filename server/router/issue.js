const express = require('express');
const router = express.Router();
const cron = require("node-cron")

const Issue = require("../model/issueSchema");
const Book = require("../model/bookSchema");
const { Query } = require('mongoose');


function create_corn_datetime(seconds,minute,hour,day_of_month,month,week_of_month){
    return seconds+" "+minute+" "+hour+" "+day_of_month+" "+month+" "+week_of_month;
}

cron.schedule(
    create_corn_datetime('00','00','00','*','*','*'),
    async function () {
        try{
        const res = await Issue.updateMany({returnDate:{$lt:new Date().getTime()},returnedDate:{$gte:this.returnDate},status:{$ne:"Returned"}},{$inc:{fine:+1}})
        console.log(res);
        }catch(err){
            console.log(err);
        }
    }
)

require('../db/conn');
router.get('/issueBook',async(req, res) =>{
    res.set('Access-Control-Allow-Origin', '*');
    const {book, student, issueDate, returnDate, status} = req.query;
    const queryObj = {};
    const search = req.query.search || "";
    if(book){
        queryObj.book = book;
    }
    if(student){
        queryObj.student = student;
    }
    if(issueDate){
        queryObj.issueDate = issueDate;
    }
    if(returnDate){
        queryObj.returnDate = returnDate;
    }
    if(status){
        queryObj.status = status;
    }
    const result = await Issue.find(queryObj).populate({path:"book",match:{bookid:{$regex:search,$options:'i'}}}).populate({path:"student",select:"name regno"}).sort({status:1,issueDate:1});
    const data = []
    result.map((val,index)=> (val.book === null)?null:data.push(val))
    res.status(200).json({data})
})

router.post('/issueBook',async(req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    const {book, student, issueDate, returnDate, status} = req.body;
    if(!book || !student){
        return res.status(401).json({msg: "Please provide book and student details"});
    }
    try{
        const alreadyfound = await Issue.findOne({book: book, student: student});
        if(alreadyfound){
            return res.status(409).json({msg:"Already issued to this student!"});
        }
        else{
            const newIssue = new Issue({book:book, student:student});
            await newIssue.save();
            await Book.updateOne({_id:book},{$inc:{copies:-1}});
            await Book.updateOne({_id:book,copies:0},{$set:{status:"unavailable"}});
            return res.status(200).json({msg:"Successfully issued!"});
        }
    }catch(error){
        console.log(error);
    }
})

router.put("/updateFines",async(req,res)=>{
    res.set('Access-Control-Allow-Origin','*');
    const {id,fine} = req.body;
    if(!id || !fine){
        return res.status(409).json({msg:"missing fields"});
    }
    try{
        await Issue.updateOne({_id:id},{$set:{fine:fine}});
        return res.status(200).json({msg:"updated successfully"});
    }catch(err){
        console.log(err);
    }
})

function getReturnDate(){
    return new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
}

router.put("/issueBook",async(req,res)=>{
    res.set('Access-Control-Allow-Origin', '*');
    const {id} = req.query;
    if(!id){
        return res.status(409).json({msg:"id is missing"});
    }
    try{
        await Issue.updateOne({_id:id},{$set:{status:"Approved",issueDate:Date.now(),returnDate:getReturnDate()}});
        return res.status(200).json({msg:"modified sucessfully"});
    }catch(err){
        console.log(err);
    }
})

router.put("/returnBook",async(req,res)=>{
    res.set('Access-Control-Allow-Origin', '*');
    const {id,bookId} = req.body;
    if(!id || !bookId){
        return res.status(409).json({msg:"id is missing"});
    }
    try{
        await Issue.updateOne({_id:id},{$set:{status:"Returned",returnedDate:Date.now()}});
        await Book.updateOne({_id:bookId},{$inc:{copies:+1},$set:{status:"Available"}});
        return res.status(200).json({msg:"modified sucessfully"});
    }catch(err){
        console.log(err);
    }
})

router.delete("/issueBook",async(req,res)=>{
    res.set('Access-Control-Allow-Origin', '*');
    const {id} = req.query;
    if(!id){
        return res.status(409).json({msg:"id is missing"});
    }
    try{
        const bookid = await Issue.findOne({_id:id});
        await Issue.deleteOne({_id:id});
        await Book.updateOne({_id:bookid.book},{$inc:{copies:+1},$set:{status:"Available"}});
        return res.status(200).json({msg:"deleted sucessfully"});
    }catch(err){
        console.log(err);
    }
})

module.exports = router;