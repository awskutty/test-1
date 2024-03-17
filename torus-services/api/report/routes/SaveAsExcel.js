/****
 @author :Msankar 
 @Date : 5/Aug/2016.
 @Description : To Search the shared report for current app user and app roles
 ****/

// Require dependencies
var reqExpress = require('express');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter')
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var Reporthelper = require('./ServiceHelper/ReportHelper')
var router = reqExpress.Router();
var NewDBInstance = require('../../../../torus-references/instance/DBInstance');

var objLogInfo = ''
var response = ''
    //Queries
router.post('/SaveAsExcel', function(pReq, pRes) {
    response = pRes
    try {
        var Params = pReq.body;
        var strReqHeader = pReq.headers
        objLogInfo = reqLogInfo.AssignLogInfoDetail(Params, pReq);
        Params.extension = 'xls'
        reqLogWriter.Eventinsert(objLogInfo);
        Reporthelper.SearchReport(Params, strReqHeader, function(rescallback) {
            if (rescallback) {
                successcallback(rescallback)
            }
        })
    } catch (ex) {
        reqLogWriter.TraceError(objLogInfo, ex, "ERR-FX-10308")
    }
})





function successcallback(res) {
    reqLogWriter.EventUpdate(objLogInfo)
    response.send(res)
}




module.exports = router