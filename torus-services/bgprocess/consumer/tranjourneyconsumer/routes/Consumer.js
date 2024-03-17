/****
  Descriptions - To consume TRAN_DATA topic to prepare auditing data in solr  
  Last_Error_Code - ERR_TRAN_JOURNEY_CONSUMER_00020
 ****/

// Require dependencies
var reqInstanceHelper = require('../../../../../torus-references/common/InstanceHelper');
var reqPath = require('path');
var reqDateFormatter = require('../../../../../torus-references/common/dateconverter/DateFormatter');
var reqTranDBInstance = require('../../../../../torus-references/instance/TranDBInstance');
var reqkafkaInstance = require('../../../../../torus-references/instance/KafkaInstance');
var reqLogWriter = require('../../../../../torus-references/log/trace/LogWriter');
var reqProducer = require('../../../../../torus-references/common/Producer');
var logFilePath = 'bgprocess/consumer/tranjourneyconsumer';
var objLogInfo = GetObjLogInfo();
var serviceName = 'TranJourneyConsumer';
var reqAsync = require('async');
var cron = require('node-cron');

var globalServiceLogDataProblemFolderPath = reqPath.join(__dirname, '../service_logs/data_problem/');
var tableName = 'TRANSACTION_JOURNEY';
// Collecting All the Consumer Thread Informations while Startup
var consumerAllThreadInfo = [];

function startConsuming(pConsumerName, pTopic, pConsumer, pKafka) {
    try {
        reqInstanceHelper.PrintInfo(pConsumerName, 'Started consuming', objLogInfo);
        reqLogWriter.EventUpdate(objLogInfo);

        var failureTopicName = 'HST_TRN_DATA_TRANJOURNEYCONSUMER_FAILURES';
        // Getting Service Params from Redis
        var maxMemorySize = 300; // In MB
        var restartFlag = false;
        var maxIdleTime = 600; // In Seconds [By Default 15Minutes]
        // var maxIdleTime = 30; // @@@
        var serviceParams = pKafka.SERVICE_PARAMS && JSON.parse(JSON.stringify(pKafka.SERVICE_PARAMS)) || {};
        if (serviceParams.FORCED_ACTIVE_THREAD_TIMEOUT_SEC) {
            maxIdleTime = serviceParams.FORCED_ACTIVE_THREAD_TIMEOUT_SEC; // Assigning the Idle Time from the Redis Service Params 
        }
        if (serviceParams.RESTART_MEMORY_VALUE_MB) {
            maxMemorySize = serviceParams.RESTART_MEMORY_VALUE_MB; // Assigning the Memory Size from the Redis Service Params 
        }
        if (serviceParams.RESTART_FLAG) {
            // Assigning the RESTART_FLAG from the Redis Service Params 
            restartFlag = serviceParams.RESTART_FLAG;
        }

        var processedMsgCount = 0;
        var tranJourneyProcess = false;
        var arrDBInsertRecoveryData = []; // Will be cleared after processing the records
        var arrDBUpdateRecoveryData = []; // Will be cleared after processing the records
        var dateFormatString = 'DD-MMM-YYYY hh:mm:ss A';
        var tranJourneyRecoveryProcessKeyName = 'TRAN_JOUNEY_RECOVERY_PROCESS';
        var tranJourneyRecoveryProcessKeyTTL = '600'; // 10 Minutes in Seconds
        var serviceLogFolderPath = reqPath.join(__dirname, '../service_logs/db_recovery/');
        var serviceLogDataPropblemFolderPath = reqPath.join(__dirname, '../service_logs/data_problem/');
        // var serviceLogFolderPath = reqPath.join(__dirname, '../service_logs/kafka/producer/');
        var maxKafkaMsgCount = pKafka.maxKafkaMsgCount;
        if (maxKafkaMsgCount) {
            if (serviceParams && serviceParams.PROCESS_MSG_COUNT) {
                maxKafkaMsgCount = serviceParams.PROCESS_MSG_COUNT;
            }
            ConsumeDataFromKafka();
        }

        if (consumerAllThreadInfo.indexOf(pTopic) == -1) {
            var consumerThread = {
                topic: pTopic,
                isDone: true,
                objLogInfo: GetObjLogInfo(),
                overAllStartTime: '',
                overAllEndTime: '',
                eachMsgStartTime: '',
                KafkaInstance: pKafka,
                Consumer: pConsumer,
                threadProcessingInfo: '',
                allTimezoneInfo: reqInstanceHelper.GetTenantLevelTimezone({}, objLogInfo)
            }
            consumerAllThreadInfo.push(consumerThread);
        }

        function ConsumeDataFromKafka(params) {
            try {
                cron.schedule('*/10 * * * * *', function () {

                    var currentTopic = pTopic;
                    var currentThreadIndex = consumerAllThreadInfo.findIndex(obj => obj.topic == currentTopic);
                    var currentThreadInfo = consumerAllThreadInfo[currentThreadIndex];
                    var objLogInfo = currentThreadInfo.objLogInfo; // Assiging unique Loginfo for Each Topic
                    // return;
                    if (currentThreadInfo.isDone) {
                        currentThreadInfo.eachMsgStartTime = new Date().toLocaleString();
                        var CheckMemoryAndIdleTimeReqObj = {
                            objLogInfo: objLogInfo,
                            CONSUMER_ALLTHREAD_INFO: consumerAllThreadInfo,
                            MSG_PROCESSED_COUNT: processedMsgCount,
                            RESTART_FLAG: restartFlag,
                            CURRENT_TOPIC: currentTopic,
                            MAX_MEMORY_SIZE: maxMemorySize
                        };
                        reqInstanceHelper.CheckMemoryAndIdleTime(CheckMemoryAndIdleTimeReqObj, function () {
                            currentThreadInfo.isDone = false; // Process Started
                            reqInstanceHelper.PrintInfo(serviceName, '---------- Consuming Data From Kafka', objLogInfo);
                            pConsumer.consume(maxKafkaMsgCount, function (error, data) {
                                if (error) {
                                    reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'ERR_TRAN_JOURNEY_CONSUMER_00017', '---------- Error While Consuming Data from Kafka - ' + currentTopic + ' ----------', error);
                                    currentThreadInfo.isDone = true; // Process Completed
                                } else {
                                    if (data && data.length) {
                                        // return pConsumer.commit();
                                        objLogInfo.TIMEZONE_INFO = ''; // Making as Empty to clear the Cache
                                        var GroupByRoutingkeyReqObj = {};
                                        GroupByRoutingkeyReqObj.objLogInfo = objLogInfo;
                                        GroupByRoutingkeyReqObj.HST_DATA = data;
                                        GroupByRoutingkeyReqObj.THREAD_INFO = currentThreadInfo;
                                        GroupByRoutingkeyReqObj.FUNCTION = StartTranJourneyProcess;
                                        reqInstanceHelper.GroupByRoutingkey(GroupByRoutingkeyReqObj, function () {
                                            currentThreadInfo.threadProcessingInfo = 'Committing Kafka Messages';
                                            reqkafkaInstance.DoCommit(pKafka, function () {
                                                currentThreadInfo.threadProcessingInfo = 'Committed Kafka Messages';
                                                currentThreadInfo.isDone = true; // Process Completed
                                            });
                                        });
                                    } else {
                                        reqInstanceHelper.PrintInfo(serviceName, '---------- There is No Data From Kafka - ' + currentTopic + ' ----------', objLogInfo);
                                        reqLogWriter.EventUpdate(objLogInfo);
                                        currentThreadInfo.isDone = true; // @@@
                                    }
                                }
                            });
                        });
                    } else {
                        reqInstanceHelper.PrintInfo(serviceName, 'Still Process is Going on For | ' + consumerThread.threadProcessingInfo, objLogInfo);
                        var CheckMemoryAndIdleTimeReqObj = {
                            objLogInfo: objLogInfo,
                            MSG_PROCESSED_COUNT: processedMsgCount,
                            RESTART_FLAG: restartFlag,
                            CURRENT_TOPIC: currentTopic,
                            MAX_MEMORY_SIZE: maxMemorySize,
                            CURRENT_THREAD_INFO: currentThreadInfo,
                            MAX_IDLE_TIME: maxIdleTime,
                            PROCESS_START_TIME: currentThreadInfo.eachMsgStartTime
                        };
                        reqInstanceHelper.CheckMemoryAndIdleTime(CheckMemoryAndIdleTimeReqObj, function () {
                            reqLogWriter.EventUpdate(objLogInfo);
                        });
                    }
                });
            } catch (error) {
                reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'ERR_TRAN_JOURNEY_CONSUMER_00018', 'Catch Error in ConsumeDataFromKafka()...', error);
            }
        }


        // Audit Log Process will be start here
        function StartTranJourneyProcess(params, StartTranJourneyProcessCB) {
            try {
                // reqTranDBInstance.GetTranDBConn(headers, false, function (tran_db_instance) {
                var threadInfo = params.THREAD_INFO;
                threadInfo.eachMsgStartTime = new Date().toLocaleString();
                var headers = params.headers;
                var objLogInfo = params.objLogInfo;
                var serviceLogDataProblemFolderPath;

                threadInfo.overAllStartTime = new Date().toLocaleString();
                reqInstanceHelper.PrintInfo(serviceName, 'Total TRAN_JOURNEY_DETAIL Data Count From Kafka Topic - ' + params.hstTableData.length, objLogInfo);
                //Getting Tran DB Connections
                headers.LOG_INFO = objLogInfo;
                threadInfo.threadProcessingInfo = 'Getting TRAN DB Connection';
                reqTranDBInstance.GetTranDBConn(headers, false, function (tran_db_instance) {
                    threadInfo.threadProcessingInfo = 'Getting TRAN DB Connection Process Completed';
                    if (headers.LOG_INFO) delete headers.LOG_INFO;
                    reqAsync.forEachOfSeries(params.hstTableData, function (message, i, CB) {
                        try {
                            serviceLogDataProblemFolderPath = globalServiceLogDataProblemFolderPath;
                            var journeyCase;
                            threadInfo.eachMsgStartTime = new Date();
                            var strMsg = message.value.HST_DATA;
                            if (strMsg) {
                                strMsg = reqInstanceHelper.ArrKeyToLowerCase([strMsg])[0];
                                var tran_id = strMsg.tran_id;
                                var dt_code = strMsg.dt_code;
                                var dtt_code = strMsg.dtt_code;
                                var dtt_description = strMsg.dtt_description;
                                var version_no = strMsg.version_no;
                                var updatedTran = JSON.parse(strMsg.tran_data);
                                var AppID = updatedTran.APP_ID;
                                var TenantID = updatedTran.TENANT_ID;
                                var routingkey = updatedTran.ROUTINGKEY;
                                if (AppID && TenantID) {
                                    serviceLogDataProblemFolderPath = serviceLogDataProblemFolderPath + TenantID + '\\' + AppID + '\\'; // Adding APP ID and Tenant ID 
                                } 
                                var colum_name = strMsg.column_name || 'COLUM_NAME_NOT_AVAILABLE';
                                // var key_column = strMsg.key_column || 'KEY_COLUMN_NOT_AVAILABLE';
                                var tranJourneyTimeKafkaTopicReqObj = {
                                    PROCESS_STATUS: updatedTran.PROCESS_STATUS,
                                    STATUS: updatedTran.STATUS,
                                    TRN_VERSION_NO: updatedTran.VERSION_NO
                                };

                                reqInstanceHelper.PrintInfo(serviceName, '************************************************', objLogInfo);
                                reqInstanceHelper.PrintInfo(serviceName, 'TRAN_JOURNEY_DETAIL Topic Data', objLogInfo);
                                reqInstanceHelper.PrintInfo(serviceName, 'ROUTINGKEY | ' + routingkey, objLogInfo);
                                reqInstanceHelper.PrintInfo(serviceName, 'TIMEZONE_INFO | ' + JSON.stringify(objLogInfo.TIMEZONE_INFO), objLogInfo);
                                reqInstanceHelper.PrintInfo(serviceName, 'TRN_CREATED_DATE | ' + updatedTran.CREATED_DATE, objLogInfo);
                                reqInstanceHelper.PrintInfo(serviceName, 'STATUS_MODIFIED_DATE | ' + updatedTran.MODIFIED_DATE, objLogInfo);
                                reqInstanceHelper.PrintInfo(serviceName, 'PROCESS_STATUS_MODIFIED_DATE | ' + updatedTran.MODIFIED_DATE, objLogInfo);
                                reqInstanceHelper.PrintInfo(serviceName, 'APP_ID | ' + AppID, objLogInfo);
                                reqInstanceHelper.PrintInfo(serviceName, 'TENANT_ID | ' + TenantID, objLogInfo);
                                reqInstanceHelper.PrintInfo(serviceName, 'VERSION_NO | ' + version_no, objLogInfo);
                                reqInstanceHelper.PrintInfo(serviceName, 'COLUM_NAME | ' + colum_name, objLogInfo);
                                reqInstanceHelper.PrintInfo(serviceName, 'DT_CODE | ' + dt_code, objLogInfo);
                                reqInstanceHelper.PrintInfo(serviceName, 'DTT_CODE | ' + dtt_code, objLogInfo);
                                reqInstanceHelper.PrintInfo(serviceName, 'DTT_DESCRIPTION | ' + dtt_description, objLogInfo);
                                reqInstanceHelper.PrintInfo(serviceName, '************************************************', objLogInfo);

                                // Getting Current Tran Infomations From the TRANSACTION_JOUNEY Table
                                var conditionObj = {
                                    TRN_ID: tran_id,
                                    DT_CODE: dt_code,
                                    DTT_CODE: dtt_code
                                };
                                reqTranDBInstance.GetTableFromTranDB(tran_db_instance, tableName, conditionObj, objLogInfo, function (result, error) {
                                    if (error) {
                                        var errorMsg = 'Error While Getting Data From TRANSACTION_JOURNEY Table';
                                        var errorCode = 'ERR_TRAN_JOURNEY_CONSUMER_00020';
                                        arrDBInsertRecoveryData.push(tranJourneyTimeKafkaTopicReqObj);

                                        eachMsgStartTime = '';
                                        reqInstanceHelper.PrintError(serviceName, objLogInfo, errorCode, errorMsg);
                                        var failureData = { DATA: tranJourneyTimeKafkaTopicReqObj, PROCESS: 'INSERT_PROCESS' };
                                        // Producing Failures Data Into a Kafka Topic
                                        failureData.ERROR_OBJ = error;
                                        failureData.ERROR_CODE = errorCode;
                                        failureData.ERROR_MSG = errorMsg;
                                        reqProducer.ProduceMessage(failureTopicName, failureData, null, function () { });
                                        var recoveryData = {
                                            PROCESS: 'SELECT',
                                            Table_Name: tableName,
                                            TOPIC_DATA: strMsg,
                                            TOPIC_OFFSET: message.offset,
                                            TOPIC_PARTITION: message.partition,
                                            ERROR_OBJ: error,
                                            ERROR_CODE: errorCode,
                                            ERROR_MSG: errorMsg
                                        };
                                        var fileContent = JSON.stringify(recoveryData);
                                        var GetServiceFileNameReqObj = {
                                            file_extension: '.json'
                                        }
                                        var fileName = reqInstanceHelper.GetServiceFileName(GetServiceFileNameReqObj);
                                        reqInstanceHelper.WriteServiceLog(serviceLogDataPropblemFolderPath, fileName, fileContent, function (result) {
                                            if (!result.status) {
                                                reqInstanceHelper.PrintInfo(serviceName, 'Failed to Create Recovery Log File in the path - ' + serviceLogDataPropblemFolderPath, objLogInfo);
                                            } else {
                                                reqInstanceHelper.PrintInfo(serviceName, 'Recovery Log File created in the path - ' + serviceLogDataPropblemFolderPath, objLogInfo);
                                            }
                                            CB(); // Start Next process
                                        });
                                    } else {
                                        if (result.length) {
                                            var exitingRecord = result[0];
                                            reqInstanceHelper.PrintInfo(serviceName, 'Comparing the Current TRAN VERSION_NO with Existing Record From DB', objLogInfo);
                                            reqInstanceHelper.PrintInfo(serviceName, 'CURRENT TRAN VERSION_NO | ' + version_no, objLogInfo);
                                            reqInstanceHelper.PrintInfo(serviceName, 'Existing TRN_VERSION_NO | ' + exitingRecord.version_no, objLogInfo);
                                            if (version_no > exitingRecord.trn_version_no) {
                                                reqInstanceHelper.PrintInfo(serviceName, 'Current TRAN VERSION_NO is Greater Than Existing Record, So Its Update CASE ', objLogInfo);
                                                // Update Case
                                                journeyCase = 'UPDATE';
                                            } else {
                                                reqInstanceHelper.PrintInfo(serviceName, 'Current TRAN VERSION_NO is Not Latest, So Skipping the TRAN ', objLogInfo);
                                                // Skipping the Tran Jouney Process Because Current Tran is Not Latest
                                                journeyCase = 'SKIP';
                                            }
                                        } else {
                                            // Insert Case
                                            journeyCase = 'INSERT';
                                            reqInstanceHelper.PrintInfo(serviceName, 'Current TRAN Is Not Already Existed, So Its INSERT Case', objLogInfo);
                                        }
                                        reqInstanceHelper.PrintInfo(serviceName, 'TRAN JOUNEY CASE | ' + journeyCase, objLogInfo);
                                        if (journeyCase == 'INSERT') { // Insert Case
                                            var createdDate = new Date(updatedTran.CREATED_DATE);
                                            tranJourneyTimeKafkaTopicReqObj.TRN_CREATED_DATE = createdDate;
                                            tranJourneyTimeKafkaTopicReqObj.TRN_CREATED_BY = updatedTran.CREATED_BY;
                                            tranJourneyTimeKafkaTopicReqObj.TRN_CREATED_NAME = updatedTran.CREATED_BY_NAME;
                                            tranJourneyTimeKafkaTopicReqObj.TRN_SYSTEM_ID = updatedTran.SYSTEM_ID;
                                            tranJourneyTimeKafkaTopicReqObj.TRN_SYSTEM_ID = updatedTran.SYSTEM_ID;
                                            tranJourneyTimeKafkaTopicReqObj.TRN_SYSTEM_NAME = updatedTran.SYSTEM_NAME;
                                            tranJourneyTimeKafkaTopicReqObj.CREATED_BY = 'TRAN_JOURNEY_CONSUMER';
                                            tranJourneyTimeKafkaTopicReqObj.TRN_TENANT_ID = updatedTran.TENANT_ID;
                                            tranJourneyTimeKafkaTopicReqObj.TRN_ID = Number(tran_id);
                                            tranJourneyTimeKafkaTopicReqObj.DT_CODE = dt_code;
                                            tranJourneyTimeKafkaTopicReqObj.DTT_CODE = dtt_code;
                                            tranJourneyTimeKafkaTopicReqObj.TENANT_ID = TenantID;
                                            tranJourneyTimeKafkaTopicReqObj.APP_ID = AppID;
                                            reqInstanceHelper.PrepareAuditColumnsInBGProcess(objLogInfo, updatedTran);
                                            if (colum_name.toUpperCase() == 'BOTH') {
                                                if (updatedTran.CREATED_DATE) {
                                                    tranJourneyTimeKafkaTopicReqObj.STATUS_MODIFIED_DATE = createdDate;
                                                    tranJourneyTimeKafkaTopicReqObj.PROCESS_STATUS_MODIFIED_DATE = createdDate;
                                                }
                                            } else if (colum_name.toUpperCase() == 'STATUS') {
                                                if (updatedTran.CREATED_DATE) {
                                                    tranJourneyTimeKafkaTopicReqObj.STATUS_MODIFIED_DATE = createdDate;
                                                }
                                            } else if (colum_name.toUpperCase() == 'PROCESS_STATUS') {
                                                if (updatedTran.CREATED_DATE) {
                                                    tranJourneyTimeKafkaTopicReqObj.PROCESS_STATUS_MODIFIED_DATE = createdDate;
                                                }
                                            }
                                            reqInstanceHelper.PrintInfo(serviceName, 'Current TRN VERSION NO - 1, and So INSERT Process Started...', objLogInfo);
                                            threadInfo.threadProcessingInfo = 'INSERT Process Started';
                                            reqTranDBInstance.InsertTranDBWithAudit(tran_db_instance, tableName, [tranJourneyTimeKafkaTopicReqObj], objLogInfo, function (result, error) {
                                                threadInfo.threadProcessingInfo = 'INSERT Process Completed';
                                                if (error) {
                                                    var errorMsg = 'Error While inserting into TRANSACTION_JOURNEY Table';
                                                    var errorCode = 'ERR_TRAN_JOURNEY_CONSUMER_00003';
                                                    arrDBInsertRecoveryData.push(tranJourneyTimeKafkaTopicReqObj);

                                                    eachMsgStartTime = '';
                                                    reqInstanceHelper.PrintError(serviceName, objLogInfo, errorCode, errorMsg);
                                                    var failureData = { DATA: tranJourneyTimeKafkaTopicReqObj, PROCESS: 'INSERT_PROCESS' };
                                                    // Producing Failures Data Into a Kafka Topic
                                                    failureData.ERROR_OBJ = error;
                                                    failureData.ERROR_CODE = errorCode;
                                                    failureData.ERROR_MSG = errorMsg;
                                                    reqProducer.ProduceMessage(failureTopicName, failureData, null, function () { });
                                                    var recoveryData = {
                                                        PROCESS: 'INSERT',
                                                        Table_Name: tableName,
                                                        TOPIC_DATA: strMsg,
                                                        TOPIC_OFFSET: message.offset,
                                                        TOPIC_PARTITION: message.partition,
                                                        ERROR_OBJ: error,
                                                        ERROR_CODE: errorCode,
                                                        ERROR_MSG: errorMsg
                                                    };
                                                    var fileContent = JSON.stringify(recoveryData);
                                                    var GetServiceFileNameReqObj = {
                                                        file_extension: '.json'
                                                    }
                                                    var fileName = reqInstanceHelper.GetServiceFileName(GetServiceFileNameReqObj);
                                                    reqInstanceHelper.WriteServiceLog(serviceLogDataPropblemFolderPath, fileName, fileContent, function (result) {
                                                        if (!result.status) {
                                                            reqInstanceHelper.PrintInfo(serviceName, 'Failed to Create Recovery Log File in the path - ' + serviceLogDataPropblemFolderPath, objLogInfo);
                                                        } else {
                                                            reqInstanceHelper.PrintInfo(serviceName, 'Recovery Log File created in the path - ' + serviceLogDataPropblemFolderPath, objLogInfo);
                                                        }
                                                        CB(); // Start Next process
                                                    });
                                                } else {
                                                    CB(); // Start Next process
                                                }
                                            });
                                        } else if (journeyCase == 'UPDATE') {
                                            reqInstanceHelper.PrintInfo(serviceName, 'Current TRN VERSION NO - ' + version_no + ', and So UPDATE Process Started...', objLogInfo);
                                            // Update Case
                                            reqInstanceHelper.PrepareAuditColumnsInBGProcess(objLogInfo, updatedTran);
                                            if (colum_name.toUpperCase() == 'BOTH') {

                                                if (updatedTran.MODIFIED_DATE) {
                                                    tranJourneyTimeKafkaTopicReqObj.STATUS_MODIFIED_DATE = new Date(updatedTran.MODIFIED_DATE);
                                                    tranJourneyTimeKafkaTopicReqObj.PROCESS_STATUS_MODIFIED_DATE = new Date(updatedTran.MODIFIED_DATE);
                                                }
                                            } else if (colum_name.toUpperCase() == 'STATUS') {
                                                if (updatedTran.MODIFIED_DATE) {
                                                    tranJourneyTimeKafkaTopicReqObj.STATUS_MODIFIED_DATE = new Date(updatedTran.MODIFIED_DATE);
                                                }
                                            } else if (colum_name.toUpperCase() == 'PROCESS_STATUS') {
                                                if (updatedTran.MODIFIED_DATE) {
                                                    tranJourneyTimeKafkaTopicReqObj.PROCESS_STATUS_MODIFIED_DATE = new Date(updatedTran.MODIFIED_DATE);
                                                }
                                            } else { }
                                            tranJourneyTimeKafkaTopicReqObj.TENANT_ID = TenantID;
                                            tranJourneyTimeKafkaTopicReqObj.APP_ID = AppID;

                                            threadInfo.threadProcessingInfo = 'UPDATE Process Started';
                                            reqTranDBInstance.UpdateTranDBWithAudit(tran_db_instance, tableName, tranJourneyTimeKafkaTopicReqObj, conditionObj, objLogInfo, function (result, error) {
                                                threadInfo.threadProcessingInfo = 'UPDATE Process Completed';
                                                if (error) {
                                                    arrDBUpdateRecoveryData.push({ UPDATE_DATA: tranJourneyTimeKafkaTopicReqObj, COND_OBJ: conditionObj });
                                                    var errorMsg = 'Error While Updating into TRANSACTION_JOURNEY Table';
                                                    var errorCode = 'ERR_TRAN_JOURNEY_CONSUMER_00015';
                                                    reqInstanceHelper.PrintError(serviceName, objLogInfo, errorCode, errorMsg);
                                                    var failureData = { DATA: tranJourneyTimeKafkaTopicReqObj, PROCESS: 'UPDATE_PROCESS' };
                                                    // Producing Failures Data Into a Kafka Topic
                                                    failureData.ERROR_OBJ = error;
                                                    failureData.ERROR_CODE = errorCode;
                                                    failureData.ERROR_MSG = errorMsg;
                                                    reqProducer.ProduceMessage(failureTopicName, failureData, null, function () { });
                                                    var recoveryData = {
                                                        PROCESS: 'UPDATE',
                                                        Table_Name: tableName,
                                                        TOPIC_DATA: strMsg,
                                                        TOPIC_OFFSET: message.offset,
                                                        TOPIC_PARTITION: message.partition,
                                                        ERROR_OBJ: error,
                                                        ERROR_CODE: errorCode,
                                                        ERROR_MSG: errorMsg
                                                    };
                                                    var fileContent = JSON.stringify(recoveryData);
                                                    var GetServiceFileNameReqObj = {
                                                        file_extension: '.json'
                                                    }
                                                    var fileName = reqInstanceHelper.GetServiceFileName(GetServiceFileNameReqObj);
                                                    reqInstanceHelper.WriteServiceLog(serviceLogDataPropblemFolderPath, fileName, fileContent, function (result) {
                                                        if (!result.status) {
                                                            reqInstanceHelper.PrintInfo(serviceName, 'For Update, Failed to Create Recovery Log File in the path - ' + serviceLogDataPropblemFolderPath, objLogInfo);
                                                        } else {
                                                            reqInstanceHelper.PrintInfo(serviceName, 'For Update, Recovery Log File created in the path - ' + serviceLogDataPropblemFolderPath, objLogInfo);
                                                        }
                                                    });
                                                }
                                                CB();
                                            });
                                        } else {
                                            reqInstanceHelper.PrintInfo(serviceName, 'Current TRAN Will be Skipped Due to the CASE - SKIP', objLogInfo);
                                            CB();
                                        }
                                    }
                                });

                            } else {
                                var errorMsg = 'Message not valid';
                                var errorCode = 'ERR_TRAN_JOURNEY_CONSUMER_00004';
                                reqInstanceHelper.PrintError(serviceName, objLogInfo, errorCode, errorMsg);
                                var failureData = { HST_DATA: message };
                                // Producing Failures Data Into a Kafka Topic
                                failureData.ERROR_OBJ = '';
                                failureData.ERROR_CODE = errorCode;
                                failureData.ERROR_MSG = errorMsg;
                                reqProducer.ProduceMessage(failureTopicName, failureData, null, function () {
                                    var recoveryData = {
                                        PROCESS: 'PREPARATION',
                                        Table_Name: tableName,
                                        TOPIC_DATA: message,
                                        TOPIC_OFFSET: message.offset,
                                        TOPIC_PARTITION: message.partition,
                                        ERROR_OBJ: '',
                                        ERROR_CODE: errorCode,
                                        ERROR_MSG: errorMsg
                                    };
                                    var fileContent = JSON.stringify(recoveryData);
                                    var GetServiceFileNameReqObj = {
                                        file_extension: '.json'
                                    }
                                    var fileName = reqInstanceHelper.GetServiceFileName(GetServiceFileNameReqObj);
                                    reqInstanceHelper.WriteServiceLog(serviceLogDataPropblemFolderPath, fileName, fileContent, function (result) {
                                        if (!result.status) {
                                            reqInstanceHelper.PrintInfo(serviceName, 'For Invalid Message, Failed to Create Recovery Log File in the path - ' + serviceLogDataPropblemFolderPath, objLogInfo);
                                        } else {
                                            reqInstanceHelper.PrintInfo(serviceName, 'For Invalid Message, Recovery Log File created in the path - ' + serviceLogDataPropblemFolderPath, objLogInfo);
                                        }
                                        CB();
                                    });
                                });
                            }
                        } catch (error) {
                            var errorMsg = 'Catch Error in forEachOfSeries()';
                            var errorCode = 'ERR_TRAN_JOURNEY_CONSUMER_00016';
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, errorCode, errorMsg);
                            var failureData = { HST_DATA: message };
                            // Producing Failures Data Into a Kafka Topic
                            failureData.ERROR_OBJ = error;
                            failureData.ERROR_CODE = errorCode;
                            failureData.ERROR_MSG = errorMsg;
                            reqProducer.ProduceMessage(failureTopicName, failureData, null, function () {
                                var recoveryData = {
                                    PROCESS: 'PREPARATION',
                                    Table_Name: tableName,
                                    TOPIC_DATA: message,
                                    TOPIC_OFFSET: message.offset,
                                    TOPIC_PARTITION: message.partition,
                                    ERROR_OBJ: error,
                                    ERROR_CODE: errorCode,
                                    ERROR_MSG: errorMsg
                                };
                                var fileContent = JSON.stringify(recoveryData);
                                var GetServiceFileNameReqObj = {
                                    file_extension: '.json'
                                }
                                var fileName = reqInstanceHelper.GetServiceFileName(GetServiceFileNameReqObj);
                                reqInstanceHelper.WriteServiceLog(serviceLogDataPropblemFolderPath, fileName, fileContent, function (result) {
                                    if (!result.status) {
                                        reqInstanceHelper.PrintInfo(serviceName, 'For Invalid Message, Failed to Create Recovery Log File in the path - ' + serviceLogDataPropblemFolderPath, objLogInfo);
                                    } else {
                                        reqInstanceHelper.PrintInfo(serviceName, 'For Invalid Message, Recovery Log File created in the path - ' + serviceLogDataPropblemFolderPath, objLogInfo);
                                    }
                                    CB();
                                });
                            });
                        }
                    },
                        function () {
                            commitIntoKafka(params.hstTableData.length);
                        });


                    function commitIntoKafka(hstTableDataCount) {
                        CreateRecoveryLogs({}, function () {
                            reqInstanceHelper.PrintInfo(serviceName, 'Total Processed Message Count - ' + hstTableDataCount, objLogInfo);
                            // Closing The Connection 
                            threadInfo.threadProcessingInfo = 'Closing the DB Connections';
                            reqInstanceHelper.DestroyConn(serviceName, objLogInfo, function () {
                                threadInfo.threadProcessingInfo = 'Closed the DB Connections';
                                threadInfo.overAllEndTime = new Date().toLocaleString();
                                reqInstanceHelper.PrintInfo(serviceName, 'Process Start Time - ' + threadInfo.overAllStartTime, objLogInfo);
                                reqInstanceHelper.PrintInfo(serviceName, 'Process End Time - ' + threadInfo.overAllEndTime, objLogInfo);
                                params = {};
                                threadInfo.overAllStartTime = '';
                                threadInfo.overAllEndTime = '';
                                threadInfo.eachMsgStartTime = '';// Resetting here For the Previously Processed Msg
                                reqLogWriter.EventUpdate(objLogInfo);
                                StartTranJourneyProcessCB();
                            });
                        });
                    }
                });
            } catch (error) {
                tranJourneyProcess = false;
                reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'ERR_TRAN_JOURNEY_CONSUMER_00006', 'Catch Error in StartAuditLogProcess()', error);
            }
        }


        function CreateRecoveryLogs(params, CreateRecoveryLogsCB) {
            try {
                reqAsync.series({
                    // MsgProduceFailure: function (MsgProduceFailureCB) {
                    //     if (arrKafkaTopicRecoveryData.length) {
                    //         reqInstanceHelper.PrintInfo(serviceName, 'Kafka Topic Recovery Data Count - ' + arrKafkaTopicRecoveryData.length, objLogInfo);
                    //         var recoveryData = {
                    //             MSG_PRODUCE_PROCESS: {
                    //                 Topic_Name: tranJourneyTimeKafkaTopic,
                    //                 Table_Data: arrKafkaTopicRecoveryData
                    //             }
                    //         };
                    //         var fileContent = JSON.stringify(recoveryData);
                    //         var fileName = reqInstanceHelper.GetServiceFileName();
                    //         reqInstanceHelper.WriteServiceLog(serviceLogFolderPath, fileName, fileContent, function (result) {
                    //             if (!result.status) {
                    //                 reqInstanceHelper.PrintInfo(serviceName, 'Failed to Create Recovery Log File For Recovery Data', objLogInfo);
                    //             } else {
                    //                 reqInstanceHelper.PrintInfo(serviceName, 'Recovery Log File created with Recovery Data', objLogInfo);
                    //             }
                    //             MsgProduceFailureCB();
                    //         });

                    //     } else {
                    //         reqInstanceHelper.PrintInfo(serviceName, 'There is No Recovery Data for Producing Msg into Kafka Topic', objLogInfo);
                    //         MsgProduceFailureCB();
                    //     }
                    // },
                    InsertProcess: function (InsertProcessCB) {
                        if (arrDBInsertRecoveryData.length) {
                            reqInstanceHelper.PrintInfo(serviceName, 'TRANSACTION_JOURNEY Table Insert Process Recovery Data Count - ' + arrDBInsertRecoveryData.length, objLogInfo);
                            var recoveryData = {
                                INSERT_PROCESS: {
                                    Table_Name: tableName,
                                    Table_Data: arrDBInsertRecoveryData
                                }
                            };
                            var fileContent = JSON.stringify(recoveryData);
                            var fileName = reqInstanceHelper.GetServiceFileName();
                            reqInstanceHelper.WriteServiceLog(serviceLogFolderPath, fileName, fileContent, function (result) {
                                if (!result.status) {
                                    reqInstanceHelper.PrintInfo(serviceName, 'Failed to Create Recovery Log File For TRANSACTION_JOURNEY Insert Process  Recovery Data', objLogInfo);
                                } else {
                                    reqInstanceHelper.PrintInfo(serviceName, 'Recovery Log File created with TRANSACTION_JOURNEY Insert Process Recovery Data', objLogInfo);
                                }
                                InsertProcessCB();
                            });

                        } else {
                            reqInstanceHelper.PrintInfo(serviceName, 'There is No Recovery Data for TRANSACTION_JOURNEY Insert Process', objLogInfo);
                            InsertProcessCB();
                        }
                    },
                    UpdateProcess: function (UpdateProcessCB) {
                        if (arrDBUpdateRecoveryData.length) {
                            reqInstanceHelper.PrintInfo(serviceName, 'TRANSACTION_JOURNEY Table Update Process  Recovery Data Count - ' + arrDBUpdateRecoveryData.length, objLogInfo);
                            var recoveryData = {
                                UPDATE_PROCESS: {
                                    Table_Name: tableName,
                                    Table_Data: arrDBUpdateRecoveryData
                                }
                            };
                            var fileContent = JSON.stringify(recoveryData);
                            var fileName = reqInstanceHelper.GetServiceFileName();
                            reqInstanceHelper.WriteServiceLog(serviceLogFolderPath, fileName, fileContent, function (result) {
                                if (!result.status) {
                                    reqInstanceHelper.PrintInfo(serviceName, 'Failed to Create Recovery Log File For TRANSACTION_JOURNEY Update Process Recovery Data', objLogInfo);
                                } else {
                                    reqInstanceHelper.PrintInfo(serviceName, 'Recovery Log File created with TRANSACTION_JOURNEY Update Process Recovery Data', objLogInfo);
                                }
                                UpdateProcessCB();
                            });

                        } else {
                            reqInstanceHelper.PrintInfo(serviceName, 'There is No Recovery Data for TRANSACTION_JOURNEY Update Process', objLogInfo);
                            UpdateProcessCB();
                        }
                    }
                },
                    function (params) {
                        CreateRecoveryLogsCB(null, true);
                    });

            } catch (error) {
                CreateRecoveryLogsCB(error, null);
            }

        }

    } catch (error) {
        reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'ERR_TRAN_JOURNEY_CONSUMER_00005', 'Catch Error in startConsuming()', error);
    }
}

function GetObjLogInfo() {
    try {
        return reqLogWriter.GetLogInfo('TRAN_JOURNEY_CONSUMER', 'TRAN_JOURNEY_CONSUMER_PROCESS', 'TRAN_JOURNEY_CONSUMER_ACTION', logFilePath);
    } catch (error) {
        return {};
    }
}

module.exports = {
    StartConsuming: startConsuming
};
/******** End of File **********/