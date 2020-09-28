const express = require("express");
const cors = require("cors");
const path = require("path");
const bodyParser = require("body-parser");
const querystring = require("querystring");
const fs = require("fs");
const app = express();
const port = 8100;
const staticroot = path.join(__dirname,"..","client");
console.log(staticroot)
var db = [];
app.use(express.static(staticroot));
app.use(cors({origin:"*"}));
app.use(bodyParser.urlencoded({extended:false}));
app.get("/api.asp",apiResponder);
app.post("/actJiraSync.asp",apiJiraSync);
app.post("/actJiraList.asp",apiJiraList);
app.listen(port,()=>{console.log("listening localhost:"+port)})


function apiResponder(req,res)
{
    switch(req.query.perform)
    {
        case "version": getVersion(req,res); break;
        case "userlist": getUserList(req,res); break;
        case "getuser": getUserData(req,res); break;
        case "refcustomerjob": getCustomerJobList(req,res); break;
        case "refproductoperation": getProductOperationList(req,res); break;
        case "createnew": createnew(req,res); break;
        case "updateone": updateone(req,res); break;
        case "deleteone": deleteone(req,res); break;
        case "duplicateone": duplicateone(req,res); break;
        default: res.send(["Invalid timesheet request"]);
    }
    console.table(db);
}

function todo(req,res)
{
    res.send(["todo"]);
}
function getVersion(req,res)
{
    res.send(["hello timesheet v1.0"]);
}

function getUserList(req,res)
{
    var userlist = fs.readFileSync("./server/cachedata/userlist.json",{encoding:"utf-8"});
    res.send(JSON.parse(userlist));
}
function getCustomerJobList(req,res)
{
    var customerjob = fs.readFileSync("./server/cachedata/customerjob.json",{encoding:"utf-8"});
    res.send(JSON.parse(customerjob));
}
function getProductOperationList(req,res)
{
    var productoperation = fs.readFileSync("./server/cachedata/productoperation.json",{encoding:"utf-8"});
    res.send(JSON.parse(productoperation));
}

function getUserData(req,res)
{
    var user=req.query.userid;
    console.log("get user data "+user);
    try{
        userdata=JSON.parse(fs.readFileSync("./server/cachedata/userdata_"+user+".json",{encoding:"utf-8"}));
    }
    catch(err)
    {
        console.log("error getting "+user,err);
        userdata=[];
    }
    if (db.filter(d=>d.USER_ID==user).length==0)
        db=db.concat(userdata);
    else
        userdata = db.filter(d=>d.USER_ID==user);

    res.send(userdata);
}
function returndata(wipid)
{
    return db.filter(e=>e.WIP_ID==wipid)[0];
}
function newelement(user)
{
    var max = ""+(db.reduce((t,e)=>{
        if(e.WIP_ID>t) t=+e.WIP_ID;
        return t;
    },0)+1);
    return {
        "WIP_ID":max,
        "COMPANY_ID":"10",
        "USER_ID":user,
        "DELETED_YN":"N"
    };
}
function createnew(req,res)
{
    var user = req.query.userid;
    var current = newelement(user);
    db.push(current);
    res.send([current]);
}
function duplicateone(req,res)
{
    var user = req.query.userid;
    var wipid = req.query.wipid;
    var original = returndata(wipid);
    var current = newelement(user);
    Object.keys(original).forEach(k=>{
        if (k!="WIP_ID")
            current[k]=original[k];
    })
    db.push(current);
    res.send([current]);
}
function updateone(req,res)
{
    console.log(req.query);
    var wipid=req.query.wipid;
    var current = returndata(wipid);
    if (current)
    {
        var data = req.query.data.split("=");
        current[data[0]]=data[1].replace(new RegExp("'","gi"),"");
    }
    res.send([current]);
}
function deleteone(req,res)
{
    var wipid=req.query.wipid;
    var current = returndata(wipid);
    current.DELETED_YN="Y";
    res.send([current]);
}

function apiJiraList(req,res)
{
    var ticketlist = {
        result: JSON.stringify({issues:
            [
                {
                    key:"CS-0000",
                    fields:{
                        summary:"desc cs-0000"
                    }
                }
            ]}
            )
    };
    res.send(JSON.stringify(ticketlist));
}

function apiJiraSync(req,res)
{
    var jiraNum = req.body.ROW_DATA;
    if (jiraNum) jiraNum=JSON.parse(jiraNum).JiraTaskNum;
    var ticketdesc = {
        jrSummary:"Generic Ticket " + jiraNum
    };
    res.send(ticketdesc);
}