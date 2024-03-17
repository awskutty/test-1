/*
 *   @Author : Ragavendran
 *   @Description : To create a scheduler job
 *   @status : Completed
 *   @created-Date : 19/10/2016
 *   @updated-at : 07/04/2017
 */


var rootpath = "../../../../";
var modPath = rootpath + 'node_modules/'
var reqExpress = require(modPath + 'express');
var router = reqExpress.Router();
var reqLogWriter = require(rootpath + 'torus-references/log/trace/LogWriter')
var reqLogInfo = require(rootpath + 'torus-references/log/trace/LogInfo')
var constants = require('./util/message');
var jobHelper = require('./helper/jobHelper');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqAuditLog = require('../../../../torus-references/log/audit/AuditLog');
var reqTranDBHelper = require('../../../../torus-references/instance/TranDBInstance')


var ServiceName = 'SCHEDULER_JOB_CREATE';
//global variable
var resobj = {};

router.post('/createjob', function (req, res, next) {
    try {
        CL("I", ServiceName, "Job Creation Started");
        req.headers.routingkey = "";
        req.body.PARAMS = req.body;
        req.body.SESSION_ID = "";
        reqLogInfo.AssignLogInfoDetail(req, function (objLogInfo, objSessionInfo) {
            objLogInfo.PROCESS_INFO.PROCESS_NAME = 'Create_Job';
            reqTranDBHelper.GetTranDBConn(req.headers, false, function (tran_db_instance) {
                reqAuditLog.GetProcessToken(tran_db_instance, objLogInfo, async function (error, prct_id) {
                    // var objLogInfo = reqLogInfo.AssignLogInfoDetailForCP(req.body, req);
                    objLogInfo.PROCESS = 'CreateJob-Scheduler';
                    objLogInfo.ACTION_DESC = 'CreateJob';
                    reqLogWriter.Eventinsert(objLogInfo);
                    req.body.tenant_id = objSessionInfo.TENANT_ID;
                    var sessInfo = req.body.session_info;
                    var validateRes = await validateSessionInfo();
                    function validateSessionInfo() {
                        try {
                            for (var sessiondata in sessInfo) {
                                if (sessiondata != 'CLIENT_ID') {
                                    if (sessiondata == 'U_ID') {
                                        if (sessInfo[sessiondata] !== objLogInfo.USER_ID) {
                                            return false;
                                        }
                                    } else if (sessiondata == 'LOGIN_NAME') {
                                        if (sessInfo[sessiondata] !== objLogInfo.LOGIN_NAME) {
                                            return false;
                                        }
                                    } else if (sessiondata == 'APP_ID') {
                                        if (sessInfo[sessiondata] !== objLogInfo.APP_ID) {
                                            return false;
                                        }
                                    }

                                }
                            }
                            return true
                        } catch (error) {

                        }
                    }
                    if (validateRes) {
                        jobHelper.CreateJobWithParam(req.headers, req.body, objLogInfo, prct_id, function (error, result) {
                            if (error) {
                                return res.send(error);
                                // reqInstanceHelper.SendResponse(serviceName, res, 'FAILURE', objLogInfo, 'ERR-AUT-15180', 'Exception occured while creating jon with param', error);
                            } else {
                                return res.send(result);
                                //reqInstanceHelper.SendResponse(serviceName, res, 'SUCCESS', objLogInfo, result);
                            }
                        });
                    } else {
                        CL('D', serviceName, 'Session info not matched', objLogInfo);
                        resobj.STATUS = constants.FAILURE;
                        resobj.MESSAGE = '401-UNAUTHORIZED';
                        res.send(resobj);
                    }

                });
            });
        });


    } catch (ex) {
        CL("D", ServiceName, "Exception in Job Creation" + JSON.stringify(ex));
        resobj.STATUS = constants.FAILURE;
        resobj.MESSAGE = ex;
        return callback(resobj);
    }
});

module.exports = router; 