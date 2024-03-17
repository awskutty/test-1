var reqAsync = require('async');
var reqTranDBHelper = require('../../../../torus-references/instance/TranDBInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqRedisInstance = require('../../../../torus-references/instance/RedisInstance');
var cron = require('node-cron');
var request = require('request');
var reqMoment = require('moment');
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');

var serviceName = 'SendFailedMessage';
var arrRoutingKeys = []; // To Store All the Routing Keys




// router.post('/FailureHandler', function (appRequest, appResponse) {


function FailureHandler(request, startupCallback) {
    _PrintInfo('FailureHandler started..', '');
    var objLogInfo = {};
    var strReqHeader = request.Header;
    var routingkey = strReqHeader.routingkey;
    if (arrRoutingKeys.indexOf(routingkey) == -1) {
        var objRoutingKey = {
            routingkey: routingkey,
            isDone: true,
            lastLoopingCount: 0,
            maxLoopingCount: 180,
            recoveryProcess: true,
            objLogInfo
        };
        arrRoutingKeys.push(objRoutingKey);
    }
    var routingKeyIndex = arrRoutingKeys.findIndex(obj => obj.routingkey == routingkey);
    cron.schedule('*/10 * * * * *', () => {
        arrRoutingKeys[routingKeyIndex].lastLoopingCount++;
        if (arrRoutingKeys[routingKeyIndex].isDone) {
            arrRoutingKeys[routingKeyIndex].isDone = false;
            _PrintInfo('--------------Failure Handler Cron Job Start --------------');
            runner(strReqHeader, function () {
                arrRoutingKeys[routingKeyIndex].isDone = true;
                arrRoutingKeys[routingKeyIndex].lastLoopingCount = 0;
                _PrintInfo('--------------Failure Handler Cron Job End --------------');
            });
        } else {
            reqInstanceHelper.PrintInfo(serviceName, routingkey + 'Already a cron thread is processing. So skiping this cron thread.  IsDone = ' + arrRoutingKeys[routingKeyIndex].isDone, objLogInfo);
            if (arrRoutingKeys[routingKeyIndex].lastLoopingCount > arrRoutingKeys[routingKeyIndex].maxLoopingCount) {
                reqInstanceHelper.PrintInfo('Looping Count Exceeds the Maximum Looping Count...So Resetting the ISDONE to True', objLogInfo);
                arrRoutingKeys[routingKeyIndex].isDone = true;
                arrRoutingKeys[routingKeyIndex].recoveryProcess = true;
                arrRoutingKeys[routingKeyIndex].lastLoopingCount = 0;
            }
        }
    });
    startupCallback('Started');
};

function _PrintInfo(pMessage, pLogInfo) {
    reqInstanceHelper.PrintInfo('SendMessage', pMessage, pLogInfo);
}

function runner(pHeader, runnerCB) {
    try {
        var objLogInfo = {};
        reqTranDBHelper.GetTranDBConn(pHeader, false, function (TranDbsession) {
            reqRedisInstance.GetRedisConnection(function (error, clientR) {
                reqFXDBInstance.GetFXDBConnection(pHeader, 'dep_cas', objLogInfo, function (depcasSession) {
                    getfailuredata().then(function (resRows) {
                        if (resRows.length) {
                            _PrintInfo('Failed comm process message data available', objLogInfo);
                            GethaproxyUrl().then(function (url) {
                                var apiUrl = url + '/Communication/RetryMessages';
                                createjobandschedulejob(url, resRows);
                            }).catch(function (error) {
                                console.log(error);
                                runnerCB();
                            });
                        } else {
                            _PrintInfo(' >>>>>>>> Data not available -  comm process message  in FAILED status <<<<<<', objLogInfo);
                            runnerCB();
                        }
                    }).catch(function (error) {
                        _PrintInfo('Error Occured get data from COMM_PROCESS_MESSAGE ' + error, objLogInfo);
                        runnerCB();
                    });


                    function getfailuredata() {
                        return new Promise((resolve, reject) => {
                            try {
                                _PrintInfo('Getting message mail sending Failed data from comm process message table', objLogInfo);
                                var cond = {};
                                cond.status = 'FAILED';
                                reqTranDBHelper.GetTableFromTranDB(TranDbsession, 'COMM_PROCESS_MESSAGE', cond, objLogInfo, function (result, error) {
                                    if (error) {
                                        reject();
                                    } else {
                                        resolve(result);
                                    }
                                });
                            } catch (error) {
                                console.log(error);
                                reject();
                            }
                        });
                    }

                    function createjobandschedulejob(apiUrl, FailureRows) {
                        _PrintInfo('createjobandschedulejob function called ', objLogInfo);
                        var SuccessUpdateID = [];
                        var RetryExceedID = [];
                        var RetrySameBusinessDay = [];
                        reqAsync.forEachSeries(FailureRows, function (row, pcallback) {
                            var parsedMsg = JSON.parse(row.message);
                            var sessionInfo = parsedMsg.sessInfo;
                            var Schduleobj = parsedMsg.SCHEDULE;
                            var retryinterval = Schduleobj.RETRY_INTERVAL;
                            var retryCount = Schduleobj.RETRY_COUNT;
                            var retryMode = Schduleobj.SCOPES || '';
                            _PrintInfo('Check atempt count - already retried count | ' + row.attempt_count, objLogInfo);
                            _PrintInfo('Check atempt count - retry count in config | ' + retryCount, objLogInfo);
                            // if ((retryCount <= row.attempt_count) )
                            if (retryCount <= row.attempt_count) {
                                _PrintInfo('Count exceeded ', objLogInfo);
                                RetryExceedID.push(row.commpm_id);
                                pcallback();
                            } else {
                                //  @ SBD                   - Same Business Day
                                //  @ AT                    - Any Time
                                //  @ scheduler_mode        - Mode of job creation (Manual/Auto)
                                if (retryMode === 'SBD') {
                                    var dbDateObj = row.created_date;
                                    var calculatedDate = reqMoment(dbDateObj).add(retryinterval, 'm').toDate();
                                    var calculatedate = reqMoment(calculatedDate).date();
                                    var currentDateObject = reqDateFormatter.GetTenantCurrentDateTime(pHeader, objLogInfo);
                                    var currentDate = reqMoment(currentDateObject).date();
                                }
                                if ((retryMode === 'SBD' && calculatedate.toString() === currentDate.toString()) || retryMode === 'AT' || retryMode === '') {
                                    _PrintInfo('Prepare create job required params ', objLogInfo);
                                    var headers = {
                                        "routingkey": sessionInfo.ROUTINGKEY,
                                        "session-id": sessionInfo.SESSION_ID
                                    };
                                    var reqJson = {
                                        url: apiUrl + '/Communication/RetryMessages',
                                        method: "POST",
                                        json: true,
                                        PARAMS: {
                                            CommpmID: row.commpm_id
                                        },
                                        headers: headers
                                    };

                                    var SchedulerInfo = {
                                        "run_category": "Single",
                                        "run_type": "Time_After",
                                        "frequency_type": "MINS", //"SECS",
                                        "frequency": retryinterval
                                    };

                                    var jobObject = {};
                                    jobObject.app_id = sessionInfo.APP_ID;
                                    jobObject.calling_method = 'POST';
                                    jobObject.job_description = 'Comm Retry Process - ';
                                    jobObject.job_mode = 'PREDEFINED';
                                    jobObject.job_type = 'SERVICE';
                                    jobObject.job_created_mode = 'AUTO';
                                    jobObject.object_name = apiUrl + '/Communication/RetryMessages';
                                    jobObject.param_json = reqJson;
                                    jobObject.scheduler_info = SchedulerInfo;
                                    jobObject.CREATED_DATE = reqDateFormatter.GetTenantCurrentDateTime(pHeader, objLogInfo);
                                    jobObject.routing_key = '';
                                    jobObject.portal_type = "WP";
                                    jobObject.PROCESS_INFO = {
                                        "MODULE": "BG Process Module",
                                        "MENU_GROUP": "BG Process MG",
                                        "MENU_ITEM": "BG Process MI",
                                        "PROCESS_NAME": "BG Process"
                                    };
                                    jobObject.session_info = {
                                        "APP_ID": sessionInfo.APP_ID,
                                        "CLIENT_ID": sessionInfo.CLIENT_ID,
                                        "U_ID": sessionInfo.U_ID,
                                        "LOGIN_NAME": sessionInfo.USER_NAME
                                    },
                                        createjob(jobObject, apiUrl, headers, sessionInfo).then(function (JobResponse) {
                                            startjob(JobResponse.JOBNAME, apiUrl, headers, sessionInfo).then(function () {
                                                SuccessUpdateID.push(row.commpm_id);
                                                pcallback();
                                            });
                                        });
                                } else {
                                    _PrintInfo('SAME BUSINESS DAY', objLogInfo);
                                    RetrySameBusinessDay.push(row.commpm_id);
                                    pcallback();
                                }
                            }
                        },
                            function (error) {
                                if (error) {
                                    console.log(error);
                                    runnerCB();
                                } else {
                                    reqAsync.series({
                                        SuccessUpdateID: function (SuccessUpdateIDCB) {
                                            if (SuccessUpdateID.length) {
                                                _PrintInfo('update the status of the processed data to "RETRY_INITIATED" ', objLogInfo);
                                                var updateRow = {
                                                    STATUS: 'RETRY_INITIATED',
                                                    MODIFIED_DATE: reqDateFormatter.GetTenantCurrentDateTime(pHeader, objLogInfo)
                                                };
                                                var updateCond = {
                                                    commpm_id: SuccessUpdateID
                                                };
                                                Updatestatus(updateCond, updateRow).then(function (res) {
                                                    _PrintInfo('RETRY_INITIATED data updated successfully.', objLogInfo);
                                                    SuccessUpdateIDCB();
                                                }).catch(function (error) {
                                                    console.log(error);
                                                    SuccessUpdateIDCB();
                                                });
                                            } else {
                                                SuccessUpdateIDCB();
                                            }
                                        },
                                        RetryExceedID: function (RetryExceedIDCB) {
                                            if (RetryExceedID.length) {
                                                var updateRow = {
                                                    STATUS: 'RETRY_COUNT_EXCEEDED',
                                                    MODIFIED_DATE: reqDateFormatter.GetTenantCurrentDateTime(pHeader, objLogInfo)
                                                };
                                                var updateCond = {
                                                    commpm_id: RetryExceedID
                                                };
                                                Updatestatus(updateCond, updateRow).then(function (res) {
                                                    _PrintInfo('RETRY_COUNT_EXCEEDED data updated successfully.', objLogInfo);
                                                    RetryExceedIDCB();
                                                }).catch(function (error) {
                                                    console.log(error);
                                                    RetryExceedIDCB();
                                                });
                                            } else {
                                                RetryExceedIDCB();
                                            }
                                        },
                                        RetrySameBusinessDay: function (RetrySameBusinessDayCB) {
                                            if (RetrySameBusinessDay.length) {
                                                var updateRow = {
                                                    STATUS: 'SAME_BUSINESS_DAY_EXCEEDED',
                                                    MODIFIED_DATE: reqDateFormatter.GetTenantCurrentDateTime(pHeader, objLogInfo)
                                                };
                                                var updateCond = {
                                                    commpm_id: RetrySameBusinessDay
                                                };
                                                Updatestatus(updateCond, updateRow).then(function (res) {
                                                    _PrintInfo('SAME_BUSINESS_DAY_EXCEEDED data updated successfully.', objLogInfo);
                                                    RetrySameBusinessDayCB();
                                                }).catch(function (error) {
                                                    console.log(error);
                                                    RetrySameBusinessDayCB();
                                                });
                                            } else {
                                                RetrySameBusinessDayCB();
                                            }
                                        }
                                    },
                                        function () {
                                            runnerCB();
                                        });
                                }
                            });
                    }

                    // Create job 
                    function createjob(jobObject, apiUrl, header) {
                        try {
                            return new Promise((resolve, reject) => {
                                var reqJson = {
                                    url: apiUrl + '/Scheduler/CreateJob',
                                    method: "POST",
                                    json: true,
                                    body: jobObject,
                                    headers: header
                                };
                                _PrintInfo('Prepare create job api executing... ', objLogInfo);
                                // call scheduler api to create job
                                request(reqJson, function (error, response, body) {
                                    _PrintInfo('Create job status ' + JSON.stringify(body), objLogInfo);
                                    resolve(body);
                                });
                            });
                        } catch (error) {
                            reject();
                        }
                    }

                    function startjob(jobparam, apiUrl, header, sessionInfo) {
                        return new Promise((resolve, reject) => {
                            _PrintInfo('Going to start the created job ', objLogInfo);
                            var jobObject = {
                                portal_type: "WP",
                                app_id: sessionInfo.APP_ID,
                                job_name: jobparam,
                                PROCESS_INFO: {
                                    "MODULE": "BG Process Module",
                                    "MENU_GROUP": "BG Process MG",
                                    "MENU_ITEM": "BG Process MI",
                                    "PROCESS_NAME": "BG Process"
                                }
                            };
                            var reqJson = {
                                url: apiUrl + '/Scheduler/startjob',
                                method: "POST",
                                json: true,
                                body: jobObject,
                                headers: header
                            };
                            // call scheduler api to start job
                            request(reqJson, function (error, response, body) {
                                resolve();
                            });
                        });
                    }

                    // Update status of the COMM_PROCESS_MESSAGE table
                    function Updatestatus(updateCond, updateRow) {
                        return new Promise((resolve, reject) => {
                            reqTranDBHelper.UpdateTranDBWithAudit(TranDbsession, 'COMM_PROCESS_MESSAGE', updateRow, updateCond, objLogInfo, function (Res, err) {
                                if (err) {
                                    reject();
                                } else {
                                    _PrintInfo('Update SUCCESS ', objLogInfo);
                                    resolve();
                                }
                            });
                        });
                    };

                    // Get url from nginx url from redis
                    function GethaproxyUrl() {
                        return new Promise((resolve, reject) => {
                            try {
                                _PrintInfo('Getting NGINX_HAPROXY_URL from redis', objLogInfo);
                                clientR.get('NGINX_HAPROXY_URL', function (err, res) {
                                    if (err) {
                                        console.log("ERROR WHILE FETCHING HAPROXY/NGINX URL FROM REDIS " + JSON.stringify(err));
                                        reject();
                                    } else {
                                        if (res != undefined && res != null) {
                                            var jsonData = JSON.parse(res);
                                            if (jsonData != {}) {
                                                var url = jsonData["url"] || "";
                                                url = url.split('/microsvc')[0];
                                                console.log("Haproxy URl is " + url);
                                                _PrintInfo('Got NGINX_HAPROXY_URL from redis', objLogInfo);
                                                resolve(url);
                                            }
                                        }
                                    }
                                });
                            } catch (error) {
                                console.log(error);
                                reject();
                            }
                        });
                    }
                });
            });
        });
    } catch (error) {
        console.log(error);
        runnerCB();
    }
}
// });
module.exports = {
    FailureHandler: FailureHandler
};
