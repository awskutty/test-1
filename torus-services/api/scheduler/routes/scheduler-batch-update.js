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
var pHeaders = '';

//global variable
var pHeaders = "";
var mResCas = "";
var resobj = {};

router.post('/updatebatch', function (req, res, next) {
    try {
        pHeaders = req.headers;
        var mDevCas = '';
        req.body.SESSION_ID = "";
        var resdata = {};

        // var objLogInfo = reqLogInfo.AssignLogInfoDetailForCP(req.body, req);
        reqLogInfo.AssignLogInfoDetail(req, function (objLogInfo, objSessionInfo) {
            objLogInfo.PROCESS = 'Updatebatch-Scheduler';
            objLogInfo.ACTION_DESC = 'Updatebatch';
            reqLogWriter.Eventinsert(objLogInfo);

            reqFXDBInstance.GetFXDBConnection(pHeaders, "dep_cas", objLogInfo, function (pCltClient) {
                mDevCas = pCltClient;

                var app_id = objLogInfo.APP_ID;
                var batch_id = req.body.batch_id;
                var client_id = req.body.client_id;
                var batch_job_info = req.body.batch_job_info;
                var batch_name = req.body.batch_name;

                if (batch_id == '') {
                    batch_id = uuid.v4();
                }

                if (batch_job_info == undefined) {
                    var Updatequery = {
                        query: `update sch_batch set batch_name = ? where batch_id = ?`,
                        params: [batch_name, batch_id]
                    }
                }
                else {
                    var Updatequery = {
                        query: `update sch_batch set batch_job_info = ? where batch_id = ?`,
                        params: [batch_job_info, batch_id]
                    }
                }

                reqFXDBInstance.ExecuteSQLQueryWithParams(mDevCas, Updatequery, objLogInfo, function (pResult, pErr) {
                    if (pResult) {
                        resdata.STATUS = constants.SUCCESS;
                        resdata.MESSAGE = '';
                    }
                    else {
                        resdata.STATUS = constants.FAILURE;
                        resdata.MESSAGE = pErr.message;
                    }

                    res.send(resdata);
                });
            });
        })
    }
    catch (ex) {
        resdata.STATUS = constants.FAILURE;
        resdata.MESSAGE = pErr.message;
        res.send(resdata);
    }
});


function addSingleQuote(data) {
    if (data !== null) {
        if (data.indexOf("'") > -1) {
            data = data.replaceAll("'", "''")
        }
        return "'" + data + "'";
    }
    else {
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
    }
    else {
        return null;
    }
}

module.exports = router; 
