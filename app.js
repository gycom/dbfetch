window.onload=window.setTimeout(bodyLoad,1000);
var displaymode = window.localStorage.getItem("mode")||"EXPAND";
var state = {user:undefined};
var userlist = [];
var customerjob = [];
var productoperation = [];
var ticketlist = [];
var root = "http://jobtrack.dev.intranet.cyframe.com/CMACEntral/developertools/rssfeed/tools/timesheetroot/";
var csroot = "http://jtcyframe.prod.intranet.cyframe.com/punch/ReviewTimeSheet/";

Date.prototype.addDays = function(days) {
    var date = new Date(this.valueOf());
    date.setDate(date.getDate() + days);
    return date;
}

function CF_API(url,bText)
{
    const ret = bText?(response)=>response.text():(response)=>response.json();
    return fetch(root + "api.asp?" + JSONtoRequest(url) + "&v=" + Math.random()).then(ret);
    function JSONtoRequest(url)
    {
        var qs = [];
        Object.keys(url).forEach(key=>qs.push(key + "=" + encodeURIComponent(url[key]||"")));
        return qs.join("&");
    }
}
function JIRA_API(action,body)
{
    return fetch(csroot + action,
    {
        method:"POST",
        headers:{
            "content-type":"application/x-www-form-urlencoded"
        },
        body: body
    }).then(response=>response.json());
}
function bodyLoad()
{
    document.getElementById("activeuser").innerText = "... loading data ...";
    Promise.all(
        [
            CF_API({perform:    "version"},true)
            , CF_API({perform:  "refcustomerjob"})
            , CF_API({perform:  "refproductoperation"})
            , JIRA_API("actJiraList.asp","ACTION=ListTask")
        ]
    ).then((rep)=>{
        customerjob         = safeArray("rep[1]",rep[1],normalizeCustomer);
        productoperation    = safeArray("rep[2]",rep[2],normalizeProduct);
        ticketlist          = safeArray("rep[3]",JSON.parse(rep[3].result).issues,normalizeTicket);
        start(state,rep[0]);
    }).catch(err=>{
        document.getElementById("activeuser").innerHTML = "ERROR: " + err.message;
        console.error(err)
    });
    function normalizeCustomer(e)
    {
        var x = e;
        x.CUSTOMER_ID = x.CUSTOMER_ID.trim();
        x.CUSTOMER_NAME = x.CUSTOMER_NAME.trim();
        x.PRODUCT_ID = x.PRODUCT_ID.trim();
        return x;
    }
    function normalizeProduct(e)
    {
        var x=e;
        x.PRODUCT_ID = x.PRODUCT_ID.trim();
        return x;
    }
    function normalizeTicket(e)
    {
        return {
            key: e.key,
            fields: {
                summary: e.fields.summary,
                customfield_10114: { // customer name
                    value: name(e)
                }
            }
        };
    }
    function safeArray(title,arr,normalize)
    {
        if (arr)
        {
            return arr.map(normalize);
        }
        else
        {
            document.getElementById("activeuser").innerHTML = "ERROR: " + title + " " + JSON.stringify(arr);
            return [];
        }
    }
}
function start(state,version)
{
    CF_API({perform: "userlist"})
        .then(json=>builduserlist(trimname(json)))
}
function trimname(json)
{
    return json.map(trimMe);
    function trimMe(e)
    {
        e.NAME_OF_USER=e.NAME_OF_USER.trim();
        e.USER_ID=e.USER_ID.trim();
        return e;
    }
}
function builduserlist(json)
{
    var username="";
    var cookieuser = window.localStorage.getItem("user");
    var div=document.getElementById("activeuser");
    div.innerHTML = ("<select style='display:none' id='userid' onchange='selectUser()'>"
                        + "<option value=''>--choose user--</option>" 
                        + json.sort(NameAlpha).map(renderuser).join("")
                        + "</select><span id='usernameslot'>&nbsp;"
                        + username 
                        + " (<a href='javascript:void(0)' onclick='unlockUser()'>not you?</a>)</span>");
    selectUser();
    function NameAlpha(a,b)
    {
        var a_name = a.NAME_OF_USER.split(" ")[1];
        var b_name = b.NAME_OF_USER.split(" ")[1];
        return a_name > b_name ? 1 : a_name < b_name ? -1 : 0;
    }
    function renderuser(e)
    {
        var selected="";
        if (e.USER_ID == cookieuser) {selected=" selected "; username = e.NAME_OF_USER;};
        return "<option " + selected + " value='" + e.USER_ID + "'>" + e.NAME_OF_USER + "</option>";
    }
}
function unlockUser()
{
    var opt = document.getElementById("userid");
    opt.style.display = "inline";
    var slot = document.getElementById("usernameslot");
    slot.style.display = "none";
}
function selectUser()
{
    state = {
        user: document.getElementById("userid").value
    };
    window.localStorage.setItem("user",state.user);
    if (state.user == "")
    {
        setuserdata([],[]);
    }
    else
    {
        reloadUserData();
    }
}
function reloadUserData()
{
    Promise.all(
                [
                    CF_API({perform: "getuser", userid: state.user})
                    , CF_API({perform: "getcommentlist", userid: state.user})
                ]
            ).then(result=>{
                setuserdata(result[0],result[1]);
            }).catch(err=>PopError(err));
}
function setuserdata(json,comment)
{
    if (state.user!="")
    {
        state.data = json;
        if (comment)
        state.comment = comment;
        displaydata();
        if (json.length == 0) ActionNew();
    }
    else
    {
        state.data = [];
        state.comment = [];
        displaydata();
    }
    
}
function displaydata()
{
    var div = document.getElementById("userdata");
    div.innerHTML = "";
    switch(displaymode)
    {
        case "BASIC": div.innerHTML = BasicDisplay(); break;
        default: displaymode="EXPAND"; div.innerHTML = ExpandDisplay(); break;
    }
    document.getElementById("userdata").className = displaymode;
    document.getElementById("mode").value = displaymode;
}

function BasicDisplay()
{
    return basictitle() + state.data.map(basicrow).join("");
    function basicrow(e)
    {
        return [
            "<li id='" + e.WIP_ID + "' title='" + e.WIP_ID + "' onchange='Change(this)' class='userdatalist' >"
            , ellipsis(e)
            , [ 
                checkbox(e,         "CHECKED_YN")
                ,  boxCustomer(e,   "CUSTOMER_ID", 12)
                ,  boxJob(e,        "JOB_ID", 5)
                ,  boxcalendar(e,   "PUNCH_DATE", 10)
                ,  boxOperation(e,  "PUNCH_OPERATION", 3)
                ,  boxDuration(e,   "PUNCH_DURATION", 4)
                ,  boxJira(e,       "TICKET_REF")
                ,  boxComment(e,    "COMMENT_ID")
                ].map((tag,n)=>"<span class='col-" + n + "'>" + tag + "</span>").join("")
            , jiradesc(e)
            , "</li>"
        ].join("");
    }
    function basictitle()
    {
        return ["<table style='font-weight:bolder;border-collapse: collapse;border-spacing: 0;'>"
            , "<tr>" 
            , [ 
                checkAllBox()
                ,"Client"  
                ,"Job"   
                ,"Date"   
                ,"Operation"   
                ,"Duration"   
                ,"Ticket Ref"
                ,"Comments"].map(maketitleheader).join("")
            , "</tr>" 
            , "</table>"
        ].join("");
        function maketitleheader(hdr,n)
        {
            return "<td valign=top class='col-" + n + "'>" + hdr + "</td>";
        }
    }
}

function ExpandDisplay()
{
    return expandtitle() + state.data.map(expandrow).join("");
    function expandrow(e)
    {
        return [
            "<li id='" + e.WIP_ID + "' title='" + e.WIP_ID + "' onchange='Change(this)' class='userdatalist'>"
            , ellipsis(e)
            , [ 
                checkbox(e,         "CHECKED_YN")
                ,  boxCustomer(e,   "CUSTOMER_ID", 12)
                ,  boxJob(e,        "JOB_ID", 5)
                ,  boxcalendar(e,   "PUNCH_DATE", 10)
                ,  boxOperation(e,  "PUNCH_OPERATION", 3)
                ,  boxDuration(e,   "PUNCH_DURATION", 4)
                ,  boxJira(e,       "TICKET_REF")
                ,  boxExpandComment1(e,    "COMMENT_ID")
                ,  boxExpandComment2(e,    "COMMENT_ID")
                ].map((tag,n)=>"<span class='col-" + n + "'>" + tag + "</span>").join("")
            , expandjiradesc(e)
            , "</li>"
        ].join("");
    }
    function expandtitle()
    {
        return [
            "<table style='font-weight:bolder;border-collapse: collapse;border-spacing: 0;'>"
            , "<tr>" 
            , [ 
                checkAllBox()
                ,"Client"
                ,"Job"
                ,"Date"
                ,"Operation"
                ,"Duration"
                ,"Ticket Ref"
                ,"Internal Comment"
                ,"Comment for Customer"
            ].map(maketitleheader).join("")
            , "</tr>"
            , "</table>"
        ].join("");
        function maketitleheader(hdr,n)
        {
            return "<td valign=top class='col-" + n + "'>" + hdr + "</td>";
        }
    }
}


function checkAllBox()
{
    return "<nobr><span class='imgactionfiller'></span><input type='checkbox' name='CHECK_ALL' onclick='checkAll()'></nobr>";
}
function box(key,value,size,dblclick,onchange)
{
    return [
            "<input type='text' "
            , " name='" + key + "'"
            , " value='" + (value||"") + "'"
            , " maxlength='" + (size||"15") + "'"
            , " size='" + (size||"15") + "'"
            , (key == "PUNCH_DURATION"?" style='text-align:right'" : "")
            , (key == "PUNCH_DATE"?" placeholder='yyyy-mm-dd'" : "")
            , (dblclick ? " ondblclick='" + dblclick + "(this)'" : "")
            , (onchange ? " onchange='" + onchange + "(this)'" : "")
            , " autocomplete='off'>"
            ].join("");
}
function boxDuration(e,key,size)
{
    return box(key,e[key],size,"") + "<span style='margin-left:-10px;margin-right:0;'>&nbsp;hrs</span>";
}
function boxCustomer(e,key,size)
{
    return box(key,e[key],size,"PopCustomerLookup");
}
function boxJob(e,key,size)
{
    return box(key,e[key],size,"PopJobLookup");
}
function boxOperation(e,key,size)
{
    return box(key,e[key],size,"PopOperationLookup");
}
function boxComment(e,key)
{
    var txt = e[key];
    return ("<input type='hidden' name='" + key + "' value='" + (txt||"") + "'>"
            + "<img class='memo' src='ConfirmationMemo.gif' width='16px' align='absmiddle'"
                    + " onclick='PopComment(this)' style='margin-right:30px;" + (!txt?"opacity:.5":"") + "' />"
            );
}
function boxExpandComment1(e,key)
{
    var id = e[key];
    var txt = "";
    if (e["COMMENT_ID"]) txt = (state.comment.filter(c=>c.COMMENT_ID == e["COMMENT_ID"])[0]||{SHORT_TEXT:""}).SHORT_TEXT||"";
    return [
            "<input type='hidden' name='" + key + "' value='" + (id||"") + "'><img class='memo' style='display:none;' />"
            , "<input type='text' name='SHORT_TEXT' size='50' maxlength='50' value=\"" + txt + "\" />"
        ].join("");
}
function boxExpandComment2(e,key)
{
    var id = e[key];
    var txt = "";
    if (e["COMMENT_ID"]) txt = (state.comment.filter(c=>c.COMMENT_ID == e["COMMENT_ID"])[0]||{LONG_TEXT:""}).LONG_TEXT||"";
    return [
            "<textarea name='LONG_TEXT' cols=40 rows=2>" + txt + "</textarea>"
        ].join("");
}
function checkbox(e,key)
{
    var txt = e[key]||"";
    return "<input type='checkbox' name='" + key + "' " + (txt == "Y" ? "checked" : "") + " value='Y'>";
}
function boxcalendar(e,key,size)
{
    var txt = (e[key]||"").substr(0,10);
    return ("<nobr><span class='plusmoins' onclick='plusmoins(this)'>-</span>"
            + box(key,txt,size,"PopCalendar")
            + "<span class='plusmoins' onclick='plusmoins(this)'>+</span></nobr>"
            );
}
function boxJira(e,key)
{
    var txt = e[key]||"";
    if (txt.substr(0,3).toUpperCase() == "CS-") txt = txt.substr(3);
    return "CS-"+box(key,txt,4,"PopTicketLookup","LoadJira");
}
function jiradesc(e)
{
    var txt = e["COMMENT_ID"];
    if (txt!=undefined)
    {
        var comment = state.comment.filter(c=>c.COMMENT_ID == txt)[0]||{SHORT_TEXT:""}; 
        txt = comment.SHORT_TEXT||"";
    }
    else
    {
        txt = "";
    }
    return (
        "<span class='JiraText'>" + txt + "</span>"
    );

}
function expandjiradesc(e)
{
    var txt = e["COMMENT_ID"];
    if (txt!=undefined)
    {
        var comment = state.comment.filter(c=>c.COMMENT_ID == txt)[0]||{SHORT_TEXT:""}; 
        txt = comment.SHORT_TEXT;
    }
    else
    {
        txt = "";
    }
    return (
        "<span class='JiraText' style='display:none'>" + txt + "</span>"
    );

}
function ellipsis(e)
{
    return "<img class='imgaction' src='more.png' align=absmiddle onclick='popAction(" + e.WIP_ID + ")'/>";
}
function plusmoins(obj)
{
    var dir = obj.innerText;
    var line = parentLI(obj);
    var wipid = line.id;
    var datebox = line.querySelector("input[name='PUNCH_DATE']");
    if (datebox.value != "")
        var d = new Date(datebox.value);
    else
        var d = new Date();
    d = d.addDays(dir == "-" ? -1 : 1);
    
    datebox.value = d.toJSON().substr(0,10);
    Change(line,datebox);
}
function popAction(wipid)
{
    loadingOn("actionbox",
        [
            "<ul class='menu' onclick='DoAction(" + wipid + ")'>"
            ,["New","Copy","Delete"].map(t=>"<li>" + t + "</li>").join("")
            ,"</ul>"
        ].join(""),{
            top:  window.event.clientY + "px",
            left: window.event.clientX + "px"});
}
function clearAction()
{
    loadingOff();
}
var shielded=null;
function loadingOn(toShield,innerHTML,opt)
{
    shielded=toShield;
    var div = document.createElement("div");
    div.id = "shadow"
    div.onclick = loadingOff;
    document.body.appendChild(div);
    var pop = document.createElement("div");
    pop.id=toShield;
    if (innerHTML) 
    {
        pop.innerHTML = innerHTML;
        if (opt) {
            pop.style.top = opt.top;
            pop.style.left = opt.left;
        }
        document.body.appendChild(pop);
    }
    return pop;
}
function loadingOff()
{
    var pop = document.getElementById(shielded);
    if (pop) document.body.removeChild(pop);
    var div=document.getElementById("shadow");
    if (div)
    {
        div.onclick = null;
        document.body.removeChild(div);
    }
}
function DoAction(wipid)
{
    var ev = window.event;
    var action=ev.srcElement.innerText;
    switch(action)
    {
        case "New":     ActionNew(); break;
        case "Copy":    ActionCopy(wipid); break;
        case "Delete":  ActionDelete(wipid); break;
    }
    clearAction();
}
function ActionNew()
{
    CF_API({perform: "createnew", userid: state.user})
        .then(json=>{
            state.data.push(json[0]);
            displaydata();
            var lines = document.querySelectorAll("li");
            lines[lines.length-1].querySelector("input[name='CUSTOMER_ID']").focus();
        })
        .catch(err=>PopError(err));
}
function ActionCopy(wipid)
{
    CF_API({perform: "duplicateone", userid: state.user, wipid: wipid})
        .then(json=>{
            state.data.push(json[0]);
            displaydata();
        })
        .catch(err=>PopError(err));
}
function ActionDelete(wipid)
{
    CF_API({perform: "deleteone", userid: state.user, wipid: wipid})
        .then(json=>{
            state.data = state.data.filter((d)=>d.WIP_ID != wipid);
            displaydata();
            if (state.data.length == 0) ActionNew();
        })
        .catch(err=>PopError(err));
}
function Change(li,input)
{
    var wipid = li.id; // find parent <li>
    if (!input)
        var obj = window.event.srcElement;
    else
        var obj = input;
    var data = "";
    var datamode = "updatefield";
    var shorttext = "";
    var longtext = "";
    var commentid = document.getElementById(wipid).querySelector("input[name='COMMENT_ID']").value;
    if (commentid!="")
        var param = {perform:"updatecomment",id:commentid};
    else
        var param = {perform:"createcomment",user:state.user,id:commentid,wipid:wipid};
    if (obj.type == "checkbox")
    {
        data = obj.name + "='" + (obj.checked ? "Y" : "N") + "'";
    }
    else
    {
        switch(obj.name)
        {
            case "PUNCH_DATE": 
                data = obj.name + "=TO_DATE('" + obj.value + "','YYYY-MM-DD')"; 
                break;
            case "SHORT_TEXT":
                datamode = "short";
                //shorttext = obj.value;
                param["short"] = obj.value;
                break;
            case "LONG_TEXT":
                datamode = "long";
                //longtext = obj.value;
                param["long"] = obj.value;
                break;
            default:
                data = obj.name + "='" + obj.value + "'";
                break;
        }
    }
    console.log("change ",data)
    var temp = state.data.filter(e=>e.WIP_ID == wipid)[0];
    if (temp) temp[obj.name] = obj.value;

    switch(datamode)
    {
        case "short":
        case "long":
                CF_API(param)
                .then(json=>{
                    if(commentid == "")
                    {
                        state.comment.push({COMMENT_ID:json[0].COMMENT_ID,SHORT_TEXT:json[0].SHORT_TEXT,LONG_TEXT:json[0].LONG_TEXT});
                        var line = document.getElementById(wipid);
                        var input = line.querySelector("input[name='COMMENT_ID']");
                        input.value = json[0].COMMENT_ID;
                    }
                    else
                    {
                        console.log(datamode,json)
                    }
                })
                .catch(err=>PopError(err));
            break;
        default:
            CF_API({perform: "updateone", userid: state.user, wipid: wipid, data: data})
                .then(json=>console.log("changing",json))
                .catch(err=>PopError(err));
            break;
    }
}
function PopCalendar(obj)
{
    var date = new Date();
    obj.value = date.getFullYear() + "-" + pad(date.getMonth()+1) + "-" + pad(date.getDate());
    Change(parentLI(obj),obj);
    function pad(n)
    {
        if (n < 10) return "0" + n;
        return "" + n;
    }
}
function parentLI(obj)
{
    while (obj.tagName != "LI")
        obj = obj.parentElement;
    return obj;
}
const name = (n)=>(n.fields.customfield_10114||{value:"--no customer--"}).value;
var ticketTitle = false;
function PopAllTicketLookup(wipid)
{
    ticketTitle=false;
    var div = document.querySelector("#ticketlookup");
    var filtered = ticketlist;
    filtered.sort((a,b)=>name(a)<name(b)?-1:name(a)>name(b)?1:0);
    div.innerHTML = [ 
        "<div class='JiraPop'>" 
        , "All Customer..."
        , "</div>" 
        , "<ul class='menu' onclick='CloseTicketLookup(" + wipid + ")'>"
        , filtered.map(renderTicket).join("")
        , "</ul>"
    ].join("");
}
function PopTicketLookup(obj) // TODO: add a filter on customer (need CyFrame Customer <=> JIRA Client conversion table)
{
    ticketTitle=true;
    var wipid = parentLI(obj).id; // find parent <li>
    var filtered = ticketlist;
    var line = document.getElementById(wipid);
    var currentCustomer = line.querySelector("input[name='CUSTOMER_ID']").value.trim();
    var selectedCustomer = customerjob.filter(t=>t.CUSTOMER_ID == currentCustomer)[0];
    var JiraName = selectedCustomer ? selectedCustomer.JIRA_NAME : "";
    if (JiraName!="")
        filtered = filtered.filter(e=>name(e) == JiraName);
    loadingOn("ticketlookup",
        [ 
            "<div class='JiraPop'>" 
            , JiraName 
            , "<button style='display:inline-block;position:absolute;right:0;' onclick='PopAllTicketLookup(\"" + wipid + "\")' >All Customers</button></div>"
            , "<ul class='menu' onclick='CloseTicketLookup(" + wipid + ")'>"
            , filtered.map(renderTicket).join("")
            , "</ul>"
        ].join(""));
}
function renderTicket(e,n,a)
{
    var currentCustomerName = name(e);
    var previousCustomerName = n == 0 ? "" : name(a[n-1]);
    return [ !ticketTitle?(currentCustomerName == previousCustomerName) ? "":"<li class='JiraPop'>" + currentCustomerName + "</li>":""
                , "<li class='row' ticket='" + e.key + "'>"
                , "<span class='col'>" 
                , e.key 
                , "</span>" 
                , e.fields.summary 
                , "</li>"
            ].join("");
}
function CloseTicketLookup(wipid)
{
    if (wipid)
    {
        var src = parentLI(window.event.srcElement);
        var ticket = src.getAttribute("ticket");
        var line = document.getElementById(wipid)
        var input = line.querySelector("input[name='TICKET_REF']");
        input.value = ticket.substr(3);
        Change(line,input);
        input.onchange()
    }
    loadingOff();
}

function PopCustomerLookup(obj)
{
    var wipid = parentLI(obj).id; // find parent <li>
    loadingOn("customerlookup",
                [
                    "<ul class='menu' onclick='CloseCustomerLookup("+wipid+")'>"
                    , customerjob.reduce(distinctCustomer,[]).map(renderCustomer).join("")
                    , "</ul>"
                ].join(""));
    function distinctCustomer(t,e)
    {
        if (t.filter((c)=>c.CUSTOMER_ID == e.CUSTOMER_ID).length == 0)
        {
            t.push({CUSTOMER_ID:e.CUSTOMER_ID,CUSTOMER_NAME:e.CUSTOMER_NAME})
        }
        return t;
    }
    function renderCustomer(e)
    {
        return [
                    "<li class='row' customer='" + e.CUSTOMER_ID + "'>"
                    , "<span class='col'>" + e.CUSTOMER_ID + "</span>" 
                    , e.CUSTOMER_NAME
                    , "</li>"
                ].join("");
    }
}
function CloseCustomerLookup(wipid)
{
    if (wipid)
    {
        var src = parentLI(window.event.srcElement);
        var customer = src.getAttribute("customer");
        var line = document.getElementById(wipid)
        var input = line.querySelector("input[name='CUSTOMER_ID']");
        input.value = customer;
        Change(line,input);
    }
    loadingOff();
}
function PopJobLookup(obj)
{
    var wipid = parentLI(obj).id; // find parent <li>
    var currentcustomer = document.getElementById(wipid).querySelector("input[name='CUSTOMER_ID']").value.trim();
    var joblist = customerjob.filter(filterCurrentCustomer);
    loadingOn("joblookup",
            [
                "<ul class='menu' onclick='CloseJobLookup(" + wipid + ")'>"
                , joblist.map(renderJob).join("")
                , "</ul>"
            ].join(""));
    function filterCurrentCustomer(e)
    {
        return e.CUSTOMER_ID == currentcustomer || currentcustomer == "";
    }
    function renderJob(e)
    {
        var selection = productoperation.filter(o=>o.PRODUCT_ID == e.PRODUCT_ID);
        if (selection.length == 0) return "";
        var proddesc = selection[0].PRODUCT_DESC;
        return "<li class='row' JOB_ID='" + e.JOB_HEADERS_NUM + "'>" + e.JOB_HEADERS_NUM + " - " + proddesc + "</li>";
    }
}
function CloseJobLookup(wipid)
{
    if (wipid)
    {
        var src = window.event.srcElement;
        var jobid = src.getAttribute("JOB_ID");
        var line = document.getElementById(wipid)
        var input = line.querySelector("input[name='JOB_ID']");
        input.value=jobid;
        Change(line,input);
    }
    loadingOff();
}
function PopOperationLookup(obj)
{
    var wipid = parentLI(obj).id; // find parent <li>
    var currentjob = document.getElementById(wipid).querySelector("input[name='JOB_ID']").value.trim();
    var currentproduct = "";
    var operationlist = productoperation;
    if (currentjob == "") 
    {
        operationlist = productoperation.reduce(distinctOperation,[]).sort((a,b)=>a.OP_DESC < b.OP_DESC ? -1 : a.OP_DESC > b.OP_DESC ? 1 : 0);
    }
    else
    {
        currentproduct = customerjob.filter(filterCurrentJob)[0].PRODUCT_ID;
    }
    loadingOn("operationlookup",
                [
                    "<ul class='menu' onclick='CloseOperationLookup("+wipid+")'>"
                    , operationlist.filter((p)=>p.PRODUCT_ID == currentproduct || currentproduct == "").map(renderOperation).join("")
                    ,"</ul>"
                ].join(""));
    function distinctOperation(t,e)
    {
        if (t.filter((c)=>c.OPERATION_ID == e.OPERATION_ID).length == 0)
        {
            t.push({OPERATION_ID: e.OPERATION_ID, OP_DESC: e.OP_DESC});
        }
        return t;
    }
    function filterCurrentJob(e)
    {
        var test = e.JOB_HEADERS_NUM == currentjob || currentjob == "";
        return test;
    }
    function renderOperation(e)
    {
        var opdesc = e.OP_DESC;
        return [
                    "<li class='row' OPERATION_ID='" + e.OPERATION_ID + "'>" 
                    , e.OPERATION_ID + " - " + opdesc 
                    , "</li>"
                ].join("");
    }
}
function CloseOperationLookup(wipid)
{
    if (wipid)
    {
        var src = window.event.srcElement;
        var operationid = src.getAttribute("OPERATION_ID");
        var line = document.getElementById(wipid)
        var input = line.querySelector("input[name='PUNCH_OPERATION']");
        input.value = operationid;
        Change(line,input);
    }
    loadingOff();
}
function convertpunch()
{
    if (state.user)
    {
        loadingOn("loadingscreen",
            [
                "<div style='text-align:center'>"
                ,"<img src='./Loading.gif' width='128px' style='position:absolute;top:50%'>"
                ,"</div>"
            ].join("")
        );
        CF_API({perform: "convertPunch", userid: state.user})
            .then(json=>refreshdata(json)) // TODO: return a conversion report instead
            .catch(err=>PopError(err));
    }
    else
    {
        alert("Select a user first");
    }
    function refreshdata(json)
    {
        loadingOff();
        reloadUserData();
    }
}
function PopComment(obj)
{
    var line = parentLI(obj);
    var wipid = line.id;
    var shorttext = "";
    var longtext = "";
    var buffer;
    var comment = line.querySelector("input[name='COMMENT_ID']");
    if (comment.value != "")
    {
        buffer = state.comment.filter(c=>c.COMMENT_ID == comment.value);
        shorttext = buffer[0].SHORT_TEXT||"";
        longtext = buffer[0].LONG_TEXT||"";
    }
    loadingOn("commenteditor",
                [
                    "<input type=text id='SHORT_TEXT' maxlength=50 size=50 value=\"" + htmlEncode(shorttext) + "\"><br>"
                    ,"<textarea cols='50em' rows=10 id='LONG_TEXT'>" + htmlEncode(longtext) + "</textarea><br>"
                    ,"<button onclick=\"saveComment(" + wipid + ",'" + comment.value + "')\">Save</button>"
                    ,"<button onclick='CloseComment()'>Cancel</button>"
                ].join(""));
}
function CloseComment()
{
    loadingOff();
}
function saveComment(wipid,commentid)
{
    var buffer;
    var line = document.getElementById(wipid);
    if (commentid != "")
    {
        buffer = state.comment.filter(c=>c.COMMENT_ID == commentid);
        buffer[0].SHORT_TEXT = document.getElementById("SHORT_TEXT").value;
        buffer[0].LONG_TEXT =  document.getElementById("LONG_TEXT").value;
        CF_API({perform: "updatecomment", id: commentid, short: buffer[0].SHORT_TEXT, long: buffer[0].LONG_TEXT})
            .then(json=>CloseComment())
            .catch(err=>PopError(err));
    }
    else
    {
        buffer = [{
            SHORT_TEXT: document.getElementById("SHORT_TEXT").value,
            LONG_TEXT:  document.getElementById("LONG_TEXT").value
        }];
        CF_API({perform: "createcomment", userid: state.user, wipd: wipid, short:buffer[0].SHORT_TEXT, long: buffer[0].LONG_TEXT})
            .then(json=>linkcomment(json))
            .catch(err=>PopError(err));
        function linkcomment(json)
        {
            buffer[0].COMMENT_ID = json[0].COMMENT_ID;
            state.comment.push(buffer[0]);

            var input = line.querySelector("input[name='COMMENT_ID']");
            input.value = json[0].COMMENT_ID;
            document.getElementById(wipid).querySelector("img.memo").style.opacity=1;
            commentid = input.value;
            Change(line,input);
            CloseComment();
        }
    }
    line.querySelector("span.JiraText").innerText = buffer[0].SHORT_TEXT||"";
}
function LoadJira(obj)
{
    var ROW_DATA = {
        "JiraTaskNum": obj.value
    };
    JIRA_API("actJiraSync.asp","ACTION=pickOneTaskDet&ROW_DATA=" + escape(JSON.stringify(ROW_DATA)))
        .then(json=>setJiraText(json))
        .catch(err=>PopError(err));
    function setJiraText(json)
    {
        var line = parentLI(obj);
        var sText = "";
        var compositeText = "";
        if (json.RequestStatus == 200)
        {
            sText = unescape(json.jrSummary);
            compositeText = json.jrTaskKey + " " + sText;
            comment = line.querySelector("input[name='COMMENT_ID']");
            if (comment.value != "")
            {
                var temp = state.comment.filter(e=>e.COMMENT_ID == comment.value)[0];
                temp["SHORT_TEXT"] = compositeText;                
                UpdateShortComment(line.id,comment.value,compositeText);
            }
            else
            {
                CreateShortComment(line.id,comment.value,compositeText);
            }
        }
        line.querySelector(".JiraText").innerText = compositeText;
        echoBackShortComment(line.id,compositeText);
    }
}
function UpdateShortComment(wipid,commentid,text)
{
    CF_API({perform: "short", id: commentid, text: text})
        .then(json=>updateComment(wipid,commentid,json[0].SHORT_TEXT))
        .catch(err=>PopError(err));
    function updateComment(wipid,commentid,text)
    {
        state.comment.filter(c=>c.COMMENT_ID == commentid)[0].SHORT_TEXT = text;
        echoBackShortComment(wipid,text);
    }
}
function CreateShortComment(wipid,commentid,text)
{
    CF_API({perform: "newshort", userid: state.user, wipid: wipid, text: text})
        .then(json=>appendComment(json[0]))
        .catch(err=>PopError(err));
    function appendComment(newcomment)
    {
        var temp = state.data.filter(e=>e.WIP_ID == wipid)[0];
        temp["COMMENT_ID"] = newcomment.COMMENT_ID;
        var line = document.getElementById(wipid);
        line.querySelector("input[name='COMMENT_ID']").value = newcomment.COMMENT_ID;
        echoBackShortComment(wipid,newcomment.SHORT_TEXT);
        echoBackLongComment(wipid,newcomment.LONG_TEXT);
        line.querySelector("img.memo").style.opacity = 1;
        state.comment.push(newcomment);
    }
}
function echoBackShortComment(wipid,text){
    var line = document.getElementById(wipid);
    line.querySelector("input[name='SHORT_TEXT']").value = text||"";
}
function echoBackLongComment(wipid,text){
    var line = document.getElementById(wipid);
    line.querySelector("textarea[name='LONG_TEXT']").value = text||"";
}
function htmlEncode(s) 
{
    return s.replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/'/g, '&#39;')
      .replace(/"/g, '&#34;');
}

function changeDisplayMode()
{
    displaymode=document.getElementById("mode").value;
    window.localStorage.setItem("mode",displaymode);
    reloadUserData();
}

function Navigate(e)
{
    var target = e.target;
    if (target.tagName == "INPUT")
    {
        switch(e.key)
        {
            case "ArrowUp": 
                var input = target;
                var line = parentLI(input);
                var lines = document.querySelectorAll("li");
                var ndx = Array.from(lines).indexOf(line);
                if (ndx>0) Array.from(document.querySelectorAll("input[name='" + target.name + "']"))[ndx-1].focus();
                break;
            case "ArrowDown": 
                var input = target;
                var line = parentLI(input);
                var lines = document.querySelectorAll("li");
                var ndx = Array.from(lines).indexOf(line);
                if (ndx<lines.length-1) Array.from(document.querySelectorAll("input[name='" + target.name + "']"))[ndx+1].focus();
                if (ndx==lines.length-1) ActionNew();
                break;
        }
    }
}

function PopError(err,context){
    console.log(err);
}