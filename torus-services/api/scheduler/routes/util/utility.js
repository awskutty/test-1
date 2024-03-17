/*
 *   @Author : Ragavendran
 *   @Description : Utility file
 *   @status : In-Progress
 *   @created-Date : 18/10/2016
 */


function generateRandomValue() {

}

function getCurrentDate() {

}

function getCurrentTime() {

}

function getTimeStamp() {
    var d = new Date();
    var n = d.getTime();
    return n;
}


function getVal(value) {
    if (value === undefined || value === "undefined") {
        return "";
    } else {
        return value;
    }
}

function getDateandTime() {
    var currentdate = new Date();
    var datetime =
        currentdate.getFullYear() + "-" +
        (currentdate.getMonth() + 1) + "-" +
        currentdate.getDate() + " " +
        currentdate.getHours() + ":" +
        currentdate.getMinutes() + ":" +
        currentdate.getSeconds();
    return datetime;
}



module.exports = {
    GenerateRandomValue: generateRandomValue,
    GetCurrentDate: getCurrentDate,
    GetCurrentTime: getCurrentTime,
    GetDateandTime: getDateandTime,
    GetTimeStamp: getTimeStamp
}