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

router.post('/fetchBatchLog', function (req, res, next) {
    try {
        pHeaders = req.headers;
        var mDevCas = '';
        req.body.SESSION_ID = "";
        var resdata = {};

        // var objLogInfo = reqLogInfo.AssignLogInfoDetailForCP(req.body, req);
        reqLogInfo.AssignLogInfoDetail(req, function (objLogInfo, objSessionInfo) {
            objLogInfo.PROCESS = 'CreateTemplate-Scheduler';
            objLogInfo.ACTION_DESC = 'CreateTemplate';
            reqLogWriter.Eventinsert(objLogInfo);

            reqFXDBInstance.GetFXDBConnection(pHeaders, "dep_cas", objLogInfo, function (pCltClient) {
                mDevCas = pCltClient;

                var app_id = objLogInfo.APP_ID;
                var batch_id = req.body.batch_id;

                var query = {
                    //query: `"select * from sch_batch_process_log where batch_id = '"+?+"' allow filtering"`,
                    query: `"select * from sch_batch_process_log where batch_id = ?"`,
                    params: [batch_id]
                }

                reqFXDBInstance.ExecuteSQLQueryWithParams(mDevCas, query, objLogInfo, function (pErr, pResult) {
                    if (pErr) {
                        resdata.STATUS = constants.FAILURE;
                        resdata.MESSAGE = pErr.message;
                        resdata.DATA = '';
                    }
                    else {
                        for (var i = 0; i < pResult.rows.length; i++) {
                            (pResult.rows[i]['started_on'] != '') ? pResult.rows[i]['started_on'] = formatdate(pResult.rows[i]['started_on']) : '';
                            (pResult.rows[i]['ended_on'] != '') ? pResult.rows[i]['ended_on'] = formatdate(pResult.rows[i]['ended_on']) : '';
                        }
                        resdata.STATUS = constants.SUCCESS;
                        resdata.MESSAGE = '';
                        resdata.DATA = pResult.rows;
                    }
                    res.send(resdata);
                });
            });
        })
    }
    catch (ex) {
        resdata.STATUS = constants.FAILURE;
        resdata.MESSAGE = pErr.message;
        resdata.DATA = '';
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

function formatdate(date) {
    date = new Date(date);
    var hours = date.getHours();
    var minutes = date.getMinutes();
    var ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    minutes = minutes < 10 ? '0' + minutes : minutes;
    var strTime = hours + ':' + minutes + ' ' + ampm;

    return date.getDate() + "/" + (date.getMonth() + 1) + "/" + date.getFullYear() + " " + strTime;
}

module.exports = router; 
