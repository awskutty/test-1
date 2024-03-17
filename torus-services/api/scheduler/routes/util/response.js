function GetResponse(status,message,data,error){
    var obj = {};
    obj.STATUS = status;
    obj.MESSAGE = message;
    obj.DATA = data;
    obj.ERROR = error;

    return obj;
}

module.exports = {
    GetResponse : GetResponse
}