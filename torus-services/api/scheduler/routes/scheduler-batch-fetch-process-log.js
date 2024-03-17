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

router.post('/fetchProcessLog', function (req, res, next) {
    try {
        pHeaders = req.headers;
        var mDevCas = '';
        req.body.SESSION_ID = "";
        var resdata = {};

        var objLogInfo = reqLogInfo.AssignLogInfoDetailForCP(req.body, req);
        objLogInfo.PROCESS = 'CreateTemplate-Scheduler';
        objLogInfo.ACTION_DESC = 'CreateTemplate';
        reqLogWriter.Eventinsert(objLogInfo);

        reqFXDBInstance.GetFXDBConnection(pHeaders, "dep_cas", objLogInfo, function (pCltClient) {
            mDevCas = pCltClient;

            var process_id = req.body.process_id;
            var batch_id = req.body.batch_id;
            var batch_job_info = '';

            async.series([
                function (asyncCallback) {
                    var Selquery = {
                        query: "select * from sch_batch where batch_id = ?",
                        params: [batch_id]
                    }
                    reqFXDBInstance.ExecuteSQLQueryWithParams(mDevCas, Selquery, objLogInfo, function (pErr, pResult) {
                        if (pErr) {
                            resobj.STATUS = constants.FAILURE;
                            resobj.DATA = pErr;
                            return res.send(resobj);
                        }
                        else {
                            if (pResult.rows.length > 0) {
                                batch_job_info = pResult.rows[0]['batch_job_info'];
                                asyncCallback();
                            }
                            else {
                                resobj.STATUS = constants.FAILURE;
                                resobj.DATA = '';
                                return res.send(resobj);
                            }
                        }
                    });
                },
                function (asyncCallback) {
                    var query = "select * from sch_batch_process_job_log where process_id = '" + process_id + "' allow filtering";


                    var schbatchpjLogqry = {
                        query: "select * from sch_batch_process_job_log where process_id = ?",
                        params: [process_id]
                    }
                    reqFXDBInstance.ExecuteSQLQueryWithParams(mDevCas, schbatchpjLogqry, objLogInfo, function (pResult, pErr) {
                        if (pErr) {
                            resobj.STATUS = constants.FAILURE;
                            resobj.DATA = pErr;
                            return res.send(resobj);
                        }
                        else {
                            if (batch_job_info != '') {
                                batch_job_info = JSON.parse(batch_job_info);
                                for (var i = 0; i < pResult.rows.length; i++) {
                                    batch_job_info = populateTree(batch_job_info, pResult.rows[i]['batch_id'], pResult.rows[i]['job_id'], pResult.rows[i]['job_status']);

                                }

                                batch_job_info = checkTouched(batch_job_info);
                            }

                            asyncCallback();
                        }
                    });
                }
            ], function (err) {
                if (!err) {

                    resobj.STATUS = constants.SUCCESS;
                    resobj.DATA = batch_job_info;
                    res.send(resobj);
                }
                else {
                    resobj.STATUS = constants.FAILURE;
                    resobj.DATA = err;
                    res.send(resobj);

                }
            })
        });
    }
    catch (ex) {
        resdata.STATUS = constants.FAILURE;
        resdata.MESSAGE = pErr.message;
        resdata.DATA = '';
        res.send(resdata);
    }
});


function populateTree(batch_job_info, batch_id, job_id, status) {

    for (var i = 0; i < batch_job_info[0]['children'].length; i++) {
        // get group 
        if (batch_job_info[0]['children'][i]['id'].toString() === batch_id) {
            for (var j = 0; j < batch_job_info[0]['children'][i]['children'].length; j++) {
                if (batch_job_info[0]['children'][i]['children'][j]['id'].toString() === job_id) {

                    batch_job_info[0]['children'][i]['children'][j]['istouched'] = 'true'

                    batch_job_info[0]['children'][i]['children'][j]['tree_node_status'] = status;

                }
            }
        }
    }

    return batch_job_info;
}

function checkTouched(batch_job_info) {

    for (var i = 0; i < batch_job_info[0]['children'].length; i++) {
        var tempBatchJob = batch_job_info[0]['children'][i]['children'];
        for (var j = 0; j < tempBatchJob.length; j++) {
            if (tempBatchJob[j]['istouched'] == undefined) {
                //tempBatchJob[j]['label'] = tempBatchJob[j]['label'] + " (PENDING)";
                tempBatchJob[j]['tree_node_status'] = 'PENDING'
            }

        }
        batch_job_info[0]['children'][i]['children'] = tempBatchJob;
    }
    return batch_job_info;
}


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
