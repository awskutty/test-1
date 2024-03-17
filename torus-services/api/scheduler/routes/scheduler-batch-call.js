var rootpath = "../../../../";
var modPath = rootpath + 'node_modules/'
var reqExpress = require(modPath + 'express');
var router = reqExpress.Router();
var reqCasInstance = require(rootpath + 'torus-references/instance/CassandraInstance');
var reqLogWriter = require(rootpath + 'torus-references/log/trace/LogWriter')
var reqLogInfo = require(rootpath + 'torus-references/log/trace/LogInfo')
var constants = require('./util/message');
var async = require(modPath + 'async');
var uuid = require(modPath + 'uuid');
var reqDateFormatter = require(rootpath + 'torus-references/common/dateconverter/DateFormatter')
var reqFXDBInstance = require(rootpath + 'torus-references/instance/DBInstance')
var schUtil = require('./util/schedulerUtil');

var pHeaders = '';

//global variable
var pHeaders = "";
var mResCas = "";
var resobj = {};

router.post('/callbatch', function (req, res, next) {
    try {
        pHeaders = req.headers;
        var mDevCas = '';
        req.body.SESSION_ID = "";
        var resdata = {};

        var objLogInfo = reqLogInfo.AssignLogInfoDetailForCP(req.body, req);
        objLogInfo.PROCESS = 'callbatch-Scheduler';
        objLogInfo.ACTION_DESC = 'callbatch';
        reqLogWriter.Eventinsert(objLogInfo);

        var batch_id = req.body.batch_id;
        var process_id = uuid.v4();

        reqFXDBInstance.GetFXDBConnection(pHeaders, "dep_cas", objLogInfo, function (pCltClient) {
            mDevCas = pCltClient;
            schUtil.CreateBatchProcessLog(pHeaders, mDevCas, process_id, batch_id, 'INPROGRESS', 'CREATE', function (resp) {
                schUtil.GetandExecuteBatchFlowDetail(pHeaders, batch_id, '', '', process_id, function (response) {
                    return res.send(response);
                })
            })
        });
    } catch (ex) {
        resdata.STATUS = constants.FAILURE;
        resdata.MESSAGE = ex;
        return res.send(resdata);
    }
});


function addSingleQuote(data) {
    if (data !== null) {
        if (data.indexOf("'") > -1) {
            data = data.replaceAll("'", "''")
        }
        return "'" + data + "'";
    } else {
        return null;
    }
}

function dateString(date) {
    if (date !== null) {
        var myDate = new Date(date);
        hour = myDate.getHours();
        minute = myDate.getMinutes();
        second = myDate.getSeconds();
        return "'" + reqDateFormatter.ConvertDate("'" + myDate + "'", pHeaders, true) + "'";
    } else {
        return null;
    }
}

module.exports = router;