/****
  Descriptions - To consume COMM_PROCESS_MESSAGE_FAILURE_ topic to Update COMM_PROCESS_MESSAGE Table
  @Last_Error_Code              : ERR_COMM_PROCESS_MSG_FAILURE_CONSUMER_00002
  @last_modified_by             :
 ****/

// Require dependencies
var reqAsync = require('async');
var request = require('request');
var reqMoment = require('moment');
var reqInstanceHelper = require('../../../../../torus-references/common/InstanceHelper');
var reqLogWriter = require('../../../../../torus-references/log/trace/LogWriter');
var logFilePath = 'bgprocess/consumer/commprocessmsgfailureconsumer';
var serviceName = 'CommunicationConsumer';
var reqFXDBInstance = require('../../../../../torus-references/instance/DBInstance');
var reqTranDBHelper = require('../../../../../torus-references/instance/TranDBInstance');
var reqRedisInstance = require('../../../../../torus-references/instance/RedisInstance');
var reqDateFormatter = require('../../../../../torus-references/common/dateconverter/DateFormatter');
var reqProducer = require('../../../../../torus-references/common/Producer');
const { resolve } = require('path');
const { reject } = require('lodash');
// Starting consumer for topic COMM_PROCESS_MESSAGE
async function startConsuming(pConsumerName, pTopic, pConsumer, pKafka) {
    try {


        var initialLogInfo = {};
        reqInstanceHelper.PrintInfo(pConsumerName, 'Started Consumer For ' + pTopic, initialLogInfo);
        reqLogWriter.EventUpdate(initialLogInfo);
        var dlqTopicName = 'DLQ_FX_COMM_PROCESS_MSG_FAILURE'
        var optionalParams = pKafka.OPTIONAL_PARAMS;
        var isTenantMultiThreaded = optionalParams.IS_TENANT_MULTI_THREADED;
        var headers = {}
        await pConsumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                try {
                    var objLogInfo = GetObjLogInfo(); // This Is To Get Unique Connection ID Which Helps To Filter The Log
                    objLogInfo.IS_TENANT_MULTI_THREADED = isTenantMultiThreaded; // Storing  Tenant Multi Threaded Control

                    headers = {
                        LOG_INFO: objLogInfo
                    };
                    reqInstanceHelper.PrintInfo(serviceName, 'IS_TENANT_MULTI_THREADED - ' + objLogInfo.IS_TENANT_MULTI_THREADED, objLogInfo);
                    message.value = message.value.toString(); // To Convert buffer to String while using RdKafka Npm...
                    // dead letter queue insert 

                    var topicName = message.topic;
                    var topicData = JSON.parse(message.value);
                    var data = topicData.DATA;
                    var routingkey = topicData.ROUTINGKEY;
                    var logInfoFromData = topicData.LOG_INFO;

                    if (routingkey) {
                        headers.routingkey = routingkey;
                        objLogInfo.ROUTINGKEY = routingkey;
                    }

                    // Updating All the Information From the Kafka Topic Data into objLogInfo
                    objLogInfo.headers = headers;
                    objLogInfo.LOGIN_NAME = logInfoFromData.LOGIN_NAME;
                    objLogInfo.CLIENTIP = logInfoFromData.CLIENTIP;
                    objLogInfo.TIMEZONE_INFO = logInfoFromData.TIMEZONE_INFO;
                    objLogInfo.USER_ID = logInfoFromData.USER_ID;
                    objLogInfo.CLIENTTZ = logInfoFromData.CLIENTTZ;
                    objLogInfo.CLIENTTZ_OFFSET = logInfoFromData.CLIENTTZ_OFFSET;
                    objLogInfo.SESSION_ID = logInfoFromData.SESSION_ID;
                    objLogInfo.APP_ID = logInfoFromData.APP_ID;

                    // Adding logInfoFromData to objLogInfo for Producing into topic
                    objLogInfo.LOG_INFO_FROM_DATA = logInfoFromData;

                    reqInstanceHelper.PrintInfo(serviceName, '\n', objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, '************************************************', objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, '      ' + topicName + ' KAFKA TOPIC DATA       ', objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, '      TIMEZONE_INFO - ' + JSON.stringify(objLogInfo.TIMEZONE_INFO), objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, '      CLIENTIP - ' + objLogInfo.CLIENTIP, objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, '      CLIENTTZ - ' + objLogInfo.CLIENTTZ, objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, '      CLIENTTZ_OFFSET - ' + objLogInfo.CLIENTTZ_OFFSET, objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, '      APP_ID - ' + objLogInfo.APP_ID, objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, '      TRN_ID - ' + data.trn_id, objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, '      TYPE - ' + data.type, objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, '      CREATED_DATE - ' + data.created_date, objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, '      PRCT_ID - ' + data.prct_id, objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, '      WFTPA_ID - ' + data.wftpa_id, objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, '      EVENT_CODE - ' + data.event_code, objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, '      Template Code - ' + data.commmt_code, objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, '      TENANT_ID - ' + data.tenant_id, objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, '      ROUTINGKEY - ' + routingkey, objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, '************************************************\n', objLogInfo);

                    var parsedMsg = JSON.parse(data.message);
                    var sessInfo = parsedMsg.sessInfo;
                    if (sessInfo && sessInfo.NEED_PERSIST) {
                        var condObj = {};
                        var updateData = {};
                        condObj.comm_msg_id = data.comm_msg_id;
                        var UpdateCommProcessMsgResult = {};
                        updateData.status = data.status;
                        updateData.modified_date = data.modified_date;
                        updateData.comments = data.comments;

                        // Closing The Connection 
                        // reqInstanceHelper.DestroyConn(serviceName, objLogInfo, function () { });
                        reqTranDBHelper.GetTranDBConn(headers, false, async function (tran_db_instance) {
                            try {
                                reqInstanceHelper.PrintInfo(serviceName, 'Going to Update the "COMM_PROCESS_MESSAGE" Table...', objLogInfo);
                                reqTranDBHelper.UpdateTranDBWithAudit(tran_db_instance, 'COMM_PROCESS_MESSAGE', updateData, condObj, objLogInfo, async function (result, error) {
                                    try {
                                        if (error) {
                                            UpdateCommProcessMsgResult.status = 'FAILURE';
                                            UpdateCommProcessMsgResult.errorObj = error;
                                            UpdateCommProcessMsgResult.strInfo = 'Error While Updating Data in the COMM_PROCESS_MESSAGE Table...';
                                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_COMM_PROCESS_MSG_FAILURE_CONSUMER_00001', UpdateCommProcessMsgResult.strInfo, error);
                                            topicData.error = error.stack
                                            await dlqInsert(topicData)
                                        } else {
                                            reqInstanceHelper.PrintInfo(serviceName, 'Update the "COMM_PROCESS_MESSAGE" Table Process Completed...', objLogInfo);
                                        }
                                        var AddSchedulerJobReqObj = {};
                                        AddSchedulerJobReqObj.commProcessMsgData = data;
                                        AddSchedulerJobReqObj.tran_db_instance = tran_db_instance;
                                        AddSchedulerJob(objLogInfo, headers, AddSchedulerJobReqObj, function (AddSchedulerJobResult) {
                                            reqInstanceHelper.PrintInfo(serviceName, 'Add Scheduler Job Process Completed...', objLogInfo);
                                            reqInstanceHelper.DestroyConn(serviceName, objLogInfo, function () { });
                                            return;
                                        });
                                    } catch (error) {
                                        topicData.error = error.stack
                                        await dlqInsert(topicData)
                                    }
                                });
                            } catch (error) {
                                topicData.error = error.stack
                                await dlqInsert(topicData)
                            }


                        });
                    }
                    // });



                    async function AddSchedulerJob(objLogInfo, headers, params, AddSchedulerJobCB) {
                        try {
                            /*  params Should Contains
                             - commProcessMsgData // Json Structure
                             - tran_db_instance
                              */
                            reqFXDBInstance.GetFXDBConnection(headers, 'dep_cas', objLogInfo, async function (depcasSession) {
                                try {
                                    reqRedisInstance.GetRedisConnection(async function (error, clientR) {
                                        var commProcessMsgData = params.commProcessMsgData;
                                        var TranDbsession = params.tran_db_instance;
                                        var AllSerivePorts = await getServicePort();
                                        GethaproxyUrl().then(function (url) {
                                            var apiUrl = url + '/Communication/RetryMessages';
                                            createjobandschedulejob(url, [commProcessMsgData]);
                                        }).catch(function (error) {
                                            console.log(error);
                                            AddSchedulerJobCB();
                                        });



                                        async function createjobandschedulejob(papiUrl, FailureRows) {
                                            try {
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
                                                        RetryExceedID.push(row.comm_msg_id);
                                                        pcallback();
                                                    } else {
                                                        //  @ SBD                   - Same Business Day
                                                        //  @ AT                    - Any Time
                                                        //  @ scheduler_mode        - Mode of job creation (Manual/Auto) 
                                                        // retryMode = 'SBD'

                                                        _PrintInfo('retryMode  | ' + retryMode, objLogInfo);
                                                        if (retryMode === 'SBD' || retryMode == "Same Business Day") {
                                                            var dbDateObj = row.created_date || row.CREATED_DATE;
                                                            var calculatedDate = reqMoment(dbDateObj).add(retryinterval, 'm').toDate();
                                                            var calculatedate = reqMoment(calculatedDate).date();
                                                            var currentDateObject = reqDateFormatter.GetCurrentDate(headers);
                                                            var currentDate = reqMoment(currentDateObject).date();
                                                        }
                                                        _PrintInfo('currentDate  | ' + currentDate, objLogInfo);
                                                        _PrintInfo('calculatedate  | ' + calculatedate, objLogInfo);
                                                        if (((retryMode === 'SBD' || retryMode == "Same Business Day") && calculatedate.toString() === currentDate.toString()) || (retryMode == 'Any Time' || retryMode === 'AT') || retryMode === '') {
                                                            _PrintInfo('Prepare create job required params ', objLogInfo);
                                                            var headers = {
                                                                "routingkey": sessionInfo.ROUTINGKEY,
                                                                "session-id": sessionInfo.SESSION_ID
                                                            };
                                                            // communication port 3009
                                                            var CommunicationPort = AllSerivePorts.ServicePort['Communication']
                                                            var commApiUrl = papiUrl.replace('<service_port>', CommunicationPort);
                                                            _PrintInfo('Communication url  | ' + commApiUrl, objLogInfo);
                                                            var reqJson = {
                                                                url: commApiUrl + '/Communication/RetryMessages',
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
                                                                "frequency_type": "SECS",
                                                                "frequency": 20
                                                            };

                                                            var jobObject = {};
                                                            jobObject.app_id = sessionInfo.APP_ID;
                                                            jobObject.calling_method = 'POST';
                                                            jobObject.job_description = 'Comm Retry Process - ' + row.commpm_id;
                                                            jobObject.job_mode = 'PREDEFINED';
                                                            jobObject.job_type = 'SERVICE';
                                                            jobObject.job_created_mode = 'AUTO';
                                                            jobObject.object_name = commApiUrl + '/Communication/RetryMessages';
                                                            jobObject.param_json = reqJson;
                                                            jobObject.scheduler_info = SchedulerInfo;
                                                            jobObject.CREATED_DATE = reqDateFormatter.GetCurrentDate(headers);
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
                                                            };
                                                            var schedulerPort = AllSerivePorts.ServicePort['Scheduler'];
                                                            var schedulerApiUrl = papiUrl.replace('<service_port>', schedulerPort);
                                                            _PrintInfo('Scheduler url  | ' + schedulerApiUrl, objLogInfo);
                                                            _PrintInfo('Create job request  | ' + JSON.stringify(jobObject), objLogInfo);
                                                            createjob(jobObject, schedulerApiUrl, headers, sessionInfo).then(function (JobResponse) {
                                                                var schjobObj = {
                                                                    job_name: JobResponse.JOBNAME,
                                                                    app_id: objLogInfo.APP_ID || sessionInfo.APP_ID
                                                                }

                                                                _PrintInfo('Start job Request   | ' + JSON.stringify(schjobObj), objLogInfo)

                                                                startjob(schjobObj, schedulerApiUrl, headers, sessionInfo).then(function () {
                                                                    SuccessUpdateID.push(row.comm_msg_id);
                                                                    pcallback();
                                                                });
                                                            }).catch(async (error) => {
                                                                topicData.error = error.stack
                                                                await dlqInsert(topicData)
                                                            });
                                                        } else {
                                                            _PrintInfo('SAME BUSINESS DAY', objLogInfo);
                                                            RetrySameBusinessDay.push(row.comm_msg_id);
                                                            pcallback();
                                                        }
                                                    }
                                                },
                                                    async function (error) {
                                                        if (error) {
                                                            console.log(error);
                                                            topicData.error = error.stack
                                                            await dlqInsert(topicData)
                                                            AddSchedulerJobCB();
                                                        } else {
                                                            reqAsync.series({
                                                                SuccessUpdateID: function (SuccessUpdateIDCB) {
                                                                    if (SuccessUpdateID.length) {
                                                                        _PrintInfo('update the status of the processed data to "RETRY_INITIATED" ', objLogInfo);
                                                                        var updateRow = {
                                                                            STATUS: 'RETRY_INITIATED',
                                                                            MODIFIED_DATE: reqDateFormatter.GetCurrentDate(headers)
                                                                        };
                                                                        var updateCond = {
                                                                            comm_msg_id: SuccessUpdateID
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
                                                                            MODIFIED_DATE: reqDateFormatter.GetCurrentDate(headers)
                                                                        };
                                                                        var updateCond = {
                                                                            comm_msg_id: RetryExceedID
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
                                                                            MODIFIED_DATE: reqDateFormatter.GetCurrentDate(headers)
                                                                        };
                                                                        var updateCond = {
                                                                            comm_msg_id: RetrySameBusinessDay
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
                                                                    AddSchedulerJobCB();
                                                                });
                                                        }
                                                    });
                                            } catch (error) {
                                                topicData.error = error.stack
                                                await dlqInsert(topicData)
                                            }
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
                                                        _PrintInfo('Create job api response ' + JSON.stringify(body), objLogInfo);
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
                                                    job_info: jobparam,
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
                                                    _PrintInfo('Start job api response ' + JSON.stringify(body), objLogInfo);
                                                    resolve();
                                                });
                                            });
                                        }

                                        // Update status of the COMM_PROCESS_MESSAGE table
                                        function Updatestatus(updateCond, updateRow) {
                                            return new Promise((resolve, reject) => {
                                                try {
                                                    reqTranDBHelper.UpdateTranDBWithAudit(TranDbsession, 'COMM_PROCESS_MESSAGE', updateRow, updateCond, objLogInfo, async function (Res, err) {
                                                        if (err) {
                                                            topicData.error = error.stack
                                                            dlqInsert(topicData)
                                                        } else {
                                                            _PrintInfo('Update SUCCESS ', objLogInfo);
                                                            resolve();
                                                        }
                                                    });
                                                } catch (error) {
                                                    topicData.error = error.stack
                                                    dlqInsert(topicData)
                                                }
                                            });
                                        };

                                        // Get url from nginx url from redis
                                        function GethaproxyUrl() {
                                            return new Promise(async (resolve, reject) => {
                                                try {
                                                    _PrintInfo('Getting NGINX_HAPROXY_URL from redis', objLogInfo);
                                                    var res = await clientR.get('SERVICE_MODEL')
                                                    if (res != undefined && res != null) {
                                                        var jsonData = JSON.parse(res);
                                                        if (jsonData) {
                                                            var url = jsonData["NODEFS_URL"] || "http://localhost:<service_port>";
                                                            _PrintInfo('Got NGINX_HAPROXY_URL from redis | ' + url, objLogInfo);
                                                            resolve(url);
                                                        }
                                                    }

                                                } catch (error) {
                                                    console.log(error);
                                                    reject();
                                                }
                                            });
                                        };
                                    });
                                } catch (error) {
                                    topicData.error = error.stack
                                    await dlqInsert(topicData)
                                }
                            });
                        } catch (error) {
                            console.log(error);
                            topicData.error = error.stack
                            await dlqInsert(topicData)
                            AddSchedulerJobCB();
                        }
                    }
                } catch (error) {
                    UpdateCommProcessMsgResult.status = 'FAILURE';
                    UpdateCommProcessMsgResult.errorObj = error;
                    UpdateCommProcessMsgResult.strInfo = 'Catch Error While Updating Data in the COMM_PROCESS_MESSAGE Table...';
                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_COMM_PROCESS_MSG_FAILURE_CONSUMER_00002', UpdateCommProcessMsgResult.strInfo, error);
                    topicData.error = error.stack
                    await dlqInsert(topicData)
                }
            }

        });
        function _PrintInfo(pMessage, pLogInfo) {
            reqInstanceHelper.PrintInfo(serviceName, pMessage, pLogInfo);
        }
        function dlqInsert(pKafkaTopicData) {
            reqProducer.ProduceMessage(dlqTopicName, pKafkaTopicData, headers, async function caalback(res) {
                _PrintInfo('Data produced to topic | ' + dlqTopicName, {});
            });
        }


        function getServicePort() {
            return new Promise((resolve, reject) => {
                reqInstanceHelper.ReadConfigFile(function (error, pConfig) {
                    resolve(pConfig)
                })
            })
        }



        /*
        * If consumer get `offsetOutOfRange` event, fetch data from the smallest(oldest) offset
        */
        // pConsumer.on('offsetOutOfRange', function (topic) {
        //     reqInstanceHelper.PrintWarn(pConsumerName, '------------- offsetOutOfRange ------------', objLogInfo);
        //     topic.maxNum = 2;
        //     pKafka.Offset.fetch([topic], function (err, offsets) {
        //         var min = Math.min.apply(null, offsets[topic.topic][topic.partition]);
        //         pConsumer.setOffset(topic.topic, topic.partition, min);
        //     });
        // });
    } catch (error) {
        reqInstanceHelper.PrintError(pConsumerName, objLogInfo, ' ERR-ATMT-CONSUMER-0002', 'Catch Error in startConsuming()...', error);
    }
}

function GetObjLogInfo() {
    try {
        return reqLogWriter.GetLogInfo('COMM_PROCESS_MSG_FAILURE_CONSUMER', 'COMM_PROCESS_MSG_FAILURE_CONSUMER_PROCESS', 'COMM_PROCESS_MSG_FAILURE_CONSUMER_ACTION', logFilePath);
    } catch (error) {
        return {};
    }
}

module.exports = {
    StartConsuming: startConsuming,
    GetObjLogInfo: GetObjLogInfo
};
/******** End of File **********/
