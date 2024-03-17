/****
  Descriptions - To consume TRAN_DATA topic to prepare auditing data in solr  
  @Last_Error_Code              : ERR-ATMT-CONSUMER-0012
 ****/

// Require dependencies
var reqProducer = require('../../../../../torus-references/common/Producer');
var reqInstanceHelper = require('../../../../../torus-references/common/InstanceHelper');
var reqDateFormatter = require('../../../../../torus-references/common/dateconverter/DateFormatter');
var reqRecoveryLog = require('../../../../../torus-references/log/recovery/RecoveryLog');
var reqkafkaInstance = require('../../../../../torus-references/instance/KafkaInstance');
var reqSolrInstance = require('../../../../../torus-references/instance/SolrInstance');
var reqTranDBInstance = require('../../../../../torus-references/instance/TranDBInstance');
var reqDBInstance = require('../../../../../torus-references/instance/DBInstance');
var reqLogWriter = require('../../../../../torus-references/log/trace/LogWriter');
var logFilePath = 'bgprocess/consumer/attachmentconsumer';
var objLogInfo = GetObjLogInfo();
var reqThreadHelper = require('./ThreadHelper');
var serviceName = 'AttachmentConsumer';
var reqAsync = require('async');
var cron = require('node-cron');
var reqPath = require('path');
var jsonl = require('json-literal');

var globalServiceLogDataProblemFolderPath = reqPath.join(__dirname, '../service_logs/data_problem/');
// Collecting All the Consumer Thread Informations while Startup
var consumerAllThreadInfo = [];

// Starting consumer for topic TRAN_DATA
function startConsuming(pConsumerName, pTopic, pConsumer, pKafka) {
    try {
        reqInstanceHelper.PrintInfo(pConsumerName, 'Started consuming For ' + pTopic, objLogInfo);
        reqLogWriter.EventUpdate(objLogInfo);

        var failureTopicName = 'HST_TRN_ATTACHMENTS_ATTACHMENTCONSUMER_FAILURES';
        // Getting Service Params from Redis
        var maxMemorySize = 300; // In MB
        var maxIdleTime = 600; // In Seconds [By Default 15Minutes]
        // var maxIdleTime = 30; //@@@
        var restartFlag = false;
        var redisMaxRetryCount = 5; // By Default
        var redisMaxRetryInterval = 30; // By Default 30Sec
        var redisRetryErrorList = [];
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
        if (serviceParams.MAX_PROCESS_RETRY_COUNT_ON_ERROR) {
            redisMaxRetryCount = serviceParams.MAX_PROCESS_RETRY_COUNT_ON_ERROR;
        }
        if (serviceParams.PROCESS_RETRY_INTERVAL_ON_ERROR_SEC) {
            redisMaxRetryInterval = serviceParams.PROCESS_RETRY_INTERVAL_ON_ERROR_SEC;
        }
        if (serviceParams.PROCESS_RETRY_ERROR_LIST) {
            redisRetryErrorList = serviceParams.PROCESS_RETRY_ERROR_LIST;
        }
        var hstDeleteTopicName = 'DELETE_HST_TRN_ATTACHMENTS';
        var maxKafkaMsgCount = pKafka.maxKafkaMsgCount;
        var deleteHstSchema = {
            "schema": {
                "type": "struct",
                "fields": [
                    {
                        "type": "int32"
                    }
                ]
            },
            "payload": {}
        };
        if (maxKafkaMsgCount) {
            if (serviceParams && serviceParams.PROCESS_MSG_COUNT) {
                maxKafkaMsgCount = serviceParams.PROCESS_MSG_COUNT;
            }
            ConsumeDataFromKafka();
        }

        var processedMsgCount = 0;

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
                    reqInstanceHelper.PrintInfo(serviceName, '---------- Current Thread - ' + currentTopic + ' ----------', objLogInfo);
                    // return;
                    if (currentThreadInfo.isDone) {
                        currentThreadInfo.eachMsgStartTime = new Date().toLocaleString();
                        var CheckMemoryAndIdleTimeReqObj = {
                            objLogInfo: objLogInfo,
                            CONSUMER_ALLTHREAD_INFO: consumerAllThreadInfo,
                            MSG_PROCESSED_COUNT: processedMsgCount,
                            MAX_RETRY_COUNT: redisMaxRetryCount,
                            MAX_RETRY_INTERVAL: redisMaxRetryInterval,
                            MAX_RETRY_ERROR_LIST: redisRetryErrorList,
                            RESTART_FLAG: restartFlag,
                            CURRENT_TOPIC: currentTopic,
                            MAX_MEMORY_SIZE: maxMemorySize
                        };
                        reqInstanceHelper.CheckMemoryAndIdleTime(CheckMemoryAndIdleTimeReqObj, function () {
                            currentThreadInfo.isDone = false; // Process Started
                            reqInstanceHelper.PrintInfo(serviceName, '---------- Consuming Data From Kafka Topic ----------', objLogInfo);
                            pConsumer.consume(maxKafkaMsgCount, function (error, data) {
                                if (error) {
                                    reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'ERR-ATMT-CONSUMER-0003', '---------- Error While Consuming Data from Kafka - ' + currentTopic + ' ----------', error);
                                    currentThreadInfo.isDone = true; // Process Completed
                                } else {
                                    if (data && data.length) {
                                        // return pConsumer.commit();
                                        objLogInfo.TIMEZONE_INFO = ''; // Making as Empty to clear the Cache
                                        var GroupByRoutingkeyReqObj = {};
                                        GroupByRoutingkeyReqObj.objLogInfo = objLogInfo;
                                        GroupByRoutingkeyReqObj.HST_DATA = data;
                                        GroupByRoutingkeyReqObj.THREAD_INFO = currentThreadInfo;
                                        GroupByRoutingkeyReqObj.FUNCTION = StartAttachmentLogProcess;
                                        reqInstanceHelper.GroupByRoutingkey(GroupByRoutingkeyReqObj, function () {
                                            currentThreadInfo.threadProcessingInfo = 'Committing Kafka Messages';
                                            reqkafkaInstance.DoCommit(pKafka, function () {
                                                currentThreadInfo.threadProcessingInfo = 'Committed Kafka Messages';
                                                reqInstanceHelper.PrintInfo(serviceName, 'Message Committed Successfully', objLogInfo);
                                                currentThreadInfo.isDone = true; // Process Completed
                                            });
                                        });
                                    } else {
                                        reqInstanceHelper.PrintInfo(serviceName, '---------- There is No Data From Kafka ----------', objLogInfo);
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
                            MAX_RETRY_COUNT: redisMaxRetryCount,
                            MAX_RETRY_INTERVAL: redisMaxRetryInterval,
                            RESTART_FLAG: restartFlag,
                            CURRENT_TOPIC: currentTopic,
                            MAX_MEMORY_SIZE: maxMemorySize,
                            CURRENT_THREAD_INFO: currentThreadInfo,
                            MAX_IDLE_TIME: maxIdleTime,
                            PROCESS_START_TIME: currentThreadInfo.eachMsgStartTime
                            , NEED_RESTART: true
                        };
                        reqInstanceHelper.CheckMemoryAndIdleTime(CheckMemoryAndIdleTimeReqObj, function () {
                            reqLogWriter.EventUpdate(objLogInfo);
                        });
                    }
                });
            } catch (error) {
                reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'ERR-ATMT-CONSUMER-0004', 'Catch Error in ConsumeDataFromKafka()...', error);
            }
        }



        function StartAttachmentLogProcess(params, StartAttachmentLogProcessCB) {
            try {
                var objLogInfo = params.objLogInfo;
                var arrTrnIDs = [];
                // Looping Through all the TRANS to print the TRN IDS
                for (let b = 0; b < params.hstTableData.length; b++) {
                    const element = params.hstTableData[b];
                    var hstDataObj = element.value.HST_DATA;
                    hstDataObj = reqInstanceHelper.ArrKeyToLowerCase([hstDataObj])[0];
                    // var AppID = hstDataObj.app_id;
                    // var TenantID = hstDataObj.tenant_id;
                    var newDataJson;
                    try {
                        newDataJson = jsonl.parse(hstDataObj.new_data_json);
                        newDataJson = reqInstanceHelper.ArrKeyToUpperCase([newDataJson])[0];
                        arrTrnIDs.push('TRN_ATTACHMENTS - ' + newDataJson.TRNA_ID);
                    } catch (error) {
                        var errorMsg = 'Error while parsing new_data_json';
                        var errorCode = 'ERR-ATMT-CONSUMER-0012';
                        reqInstanceHelper.PrintError(serviceName, objLogInfo, errorCode, errorMsg, error);
                    }
                }
                // Processing Trn IDs - TRN_ATTACHMENTS - 2296557
                reqInstanceHelper.PrintInfo(serviceName, 'Processing Trn IDs - ' + arrTrnIDs.toString().replace(/,/g, ' , '), objLogInfo);
                // return; // For Development


                var threadInfo = params.THREAD_INFO;
                threadInfo.eachMsgStartTime = new Date().toLocaleString();
                var headers = params.headers;
          
                var serviceLogDataProblemFolderPath;

                threadInfo.overAllStartTime = new Date().toLocaleString();
                reqInstanceHelper.PrintInfo(serviceName, 'Total HST_TRN_ATTACHMENTS Data Count From Kafka Topic - ' + params.hstTableData.length, objLogInfo);
                //Getting Tran DB Connections
                headers.LOG_INFO = objLogInfo;
                threadInfo.threadProcessingInfo = 'Getting TRAN DB Connection';
                reqTranDBInstance.GetTranDBConn(headers, false, function (tran_db_instance) {
                    threadInfo.threadProcessingInfo = 'Getting TRAN DB Connection Process Completed';
                    if (headers.LOG_INFO) delete headers.LOG_INFO;
                    //Getting Res_Cas Connections
                    threadInfo.threadProcessingInfo = 'Getting RES_CAS DB Connection';
                    reqDBInstance.GetFXDBConnection(headers, 'res_cas', objLogInfo, function (res_cas_instance) {
                        //Getting TRAN_ATMT and FX_TRAN Connections For Solr Cores
                        threadInfo.threadProcessingInfo = 'Getting TRAN_ATMT Solr Core Connection';
                        reqSolrInstance.GetSolrSearchConn(headers, 'TRAN_ATMT', function (solr_tran_atmt_instance) {
                            threadInfo.threadProcessingInfo = 'Getting FX_TRAN Solr Core Connection';
                            reqSolrInstance.GetSolrSearchConn(headers, 'FX_TRAN', function (solr_fx_tran_instance) {



                                reqAsync.forEachOfSeries(params.hstTableData, function (message, i, CB) {
                                    try {
                                        serviceLogDataProblemFolderPath = globalServiceLogDataProblemFolderPath;
                                        if (i > 0) {
                                            reqInstanceHelper.PrintInfo(serviceName, 'Processing the Next Message..', objLogInfo);
                                        }
                                        var failureData = {};
                                        failureData.RETRY_COUNT = 0;
                                        failureData.FAILURE_TOPIC_NAME = failureTopicName;
                                        failureData.HEADERS = headers;
                                        failureData.THREAD_INFO = threadInfo;
                                        failureData.SERVICE_LOG_PATH = serviceLogDataProblemFolderPath;
                                        failureData.TRAN_DB_INSTANCE = tran_db_instance;
                                        failureData.TABLE_NAME = 'HST_TRN_ATTACHMENTS';
                                        failureData.TOPIC_OFFSET = message.offset;
                                        failureData.TOPIC_PARTITION = message.partition;
                                        failureData.objLogInfo = objLogInfo;
                                        threadInfo.eachMsgStartTime = new Date();
                                        var strMsg = message.value.HST_DATA;
                                        if (strMsg) {
                                            strMsg = reqInstanceHelper.ArrKeyToLowerCase([strMsg])[0];
                                            var AppID = strMsg.app_id;
                                            var TenantID = strMsg.tenant_id;
                                            var routingkey = strMsg.routingkey;
                                            if (AppID && TenantID) {
                                                serviceLogDataProblemFolderPath = serviceLogDataProblemFolderPath + TenantID + '\\' + AppID + '\\'; // Adding APP ID and Tenant ID 
                                            }
                                            failureData.SERVICE_LOG_PATH = serviceLogDataProblemFolderPath;
                                            reqInstanceHelper.PrepareAuditColumnsInBGProcess(objLogInfo, strMsg);
                                            failureData.HST_DATA = JSON.parse(JSON.stringify(strMsg));
                                            MoveAtmtIntoSolr(JSON.parse(JSON.stringify(strMsg)), res_cas_instance, tran_db_instance, solr_tran_atmt_instance, solr_fx_tran_instance, message, failureData, CB);
                                        } else {
                                            var errorMsg = 'Message not valid';
                                            var errorCode = 'ERR-ATMT-CONSUMER-0001';
                                            reqInstanceHelper.PrintError(serviceName, objLogInfo, errorCode, errorMsg);
                                            failureData.ERROR_CODE = errorCode;
                                            failureData.ERROR_MSG = errorMsg;
                                            reqRecoveryLog.HandleConsumerFailures(failureData, CB);
                                        }

                                    } catch (error) {
                                        var errorMsg = 'Catch Error in forEachOfSeries()';
                                        var errorCode = 'ERR-ATMT-CONSUMER-0009';
                                        reqInstanceHelper.PrintError(serviceName, objLogInfo, errorCode, errorMsg, error);

                                        failureData.objLogInfo = objLogInfo;
                                        failureData.ERROR_OBJ = error.stack;
                                        failureData.ERROR_CODE = errorCode;
                                        failureData.ERROR_MSG = errorMsg;
                                        reqRecoveryLog.HandleConsumerFailures(failureData, CB);

                                        // @@@
                                        // setTimeout(function (params) {
                                        //     CB();
                                        // }, 40000)
                                    }
                                },
                                    function () {
                                        reqInstanceHelper.PrintInfo(serviceName, 'Total Processed Message Count - ' + params.hstTableData.length, objLogInfo);
                                        // Closing The Connection 
                                        threadInfo.threadProcessingInfo = 'Closing the DB Connections';
                                        reqInstanceHelper.DestroyConn(pConsumerName, objLogInfo, function () {
                                            threadInfo.threadProcessingInfo = 'Closed the DB Connections';
                                            threadInfo.overAllEndTime = new Date().toLocaleString();
                                            reqInstanceHelper.PrintInfo(serviceName, 'Process Start Time - ' + threadInfo.overAllStartTime, objLogInfo);
                                            reqInstanceHelper.PrintInfo(serviceName, 'Process End Time - ' + threadInfo.overAllEndTime, objLogInfo);
                                            params = {};
                                            threadInfo.overAllStartTime = '';
                                            threadInfo.overAllEndTime = '';
                                            threadInfo.eachMsgStartTime = '';// Resetting here For the Previously Processed Msg
                                            reqLogWriter.EventUpdate(objLogInfo);
                                            StartAttachmentLogProcessCB();
                                        });
                                    });
                            });
                        });
                    });
                });
            } catch (error) {
                reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'ERR-ATMT-CONSUMER-0005', 'Catch Error in StartAttachmentLogProcess()', error);
                StartAttachmentLogProcessCB();
            }
        }

    } catch (error) {
        reqInstanceHelper.PrintError(pConsumerName, objLogInfo, ' ERR-ATMT-CONSUMER-0002', 'Catch Error in startConsuming()...', error);
    }

    function MoveAtmtIntoSolr(strMsg, res_cas_instance, tran_db_instance, solr_tran_atmt_instance, solr_fx_tran_instance, message, failureData, MoveAtmtIntoSolrCB) {
        try {
            var headers = failureData.HEADERS;
            var threadInfo = failureData.THREAD_INFO;
            var objLogInfo = failureData.objLogInfo;
            if (failureData.RETRY_COUNT > 0) { // Checking the current record which is processed by the Retry Process
                failureData.THREAD_INFO.eachMsgStartTime = new Date().toLocaleString();
            }
            threadInfo.threadProcessingInfo = 'JSON Parsing';
            strMsg.new_data_json = reqInstanceHelper.ArrKeyToLowerCase([jsonl.parse(strMsg.new_data_json)])[0];
            threadInfo.threadProcessingInfo = 'JSON Parsed';
            var prepareMessageParam = {};
            prepareMessageParam.objLogInfo = objLogInfo;
            prepareMessageParam.hst_trn_atmt_json = strMsg;
            prepareMessageParam.res_cas_instance = res_cas_instance;
            threadInfo.threadProcessingInfo = 'Getting Image Data';
            reqThreadHelper.PrepareMessage(prepareMessageParam, function (PrepareMessageError, PrepareMessageResult) {
                if (PrepareMessageError) {
                    var errorMsg = 'Error while Getting Image Data Based on Relative Path - ' + strMsg.new_data_json.relative_path;
                    var errorCode = 'ERR-ATMT-CONSUMER-0006';
                    threadInfo.threadProcessingInfo = errorMsg;
                    reqInstanceHelper.PrintError(serviceName, objLogInfo, errorCode, errorMsg, PrepareMessageError);
                    var PrepareErrorInfoObj = {
                        errorMsg: errorMsg,
                        errorObj: PrepareMessageError,
                        errorCode: errorCode
                    };
                    PrepareErrorInfo(res_cas_instance, tran_db_instance, solr_tran_atmt_instance, solr_fx_tran_instance, message, failureData, PrepareErrorInfoObj, MoveAtmtIntoSolrCB);
                }
                else if (PrepareMessageResult.rows.length == 0) {
                    // No Image Data
                    threadInfo.threadProcessingInfo = 'No Image Data';
                    var updateCondtion = {
                        "relative_path": strMsg.new_data_json.relative_path
                    };
                    var updateObj = {
                        'IS_PROCESSED': 'Y',
                        'COMMENT_TEXT': 'There is No Image Data From TRNA_DATA Table',
                        'MODIFIED_DATE': reqDateFormatter.GetCurrentDateInUTC(headers, objLogInfo)
                    };
                    threadInfo.threadProcessingInfo = 'Updating TRN_ATTACHMENTS as No Image Data';
                    reqTranDBInstance.UpdateTranDB(tran_db_instance, 'TRN_ATTACHMENTS', updateObj, updateCondtion, objLogInfo, function (result, error) {
                        if (error) {
                            reqInstanceHelper.PrintInfo(serviceName, 'Error occured while update is_process in TRN_ATTACHMENTS TABLE' + error, objLogInfo);
                            var errorMsg = 'Error while Updating Data into TRN_ATTACHMENTS Table for Relative Path - ' + strMsg.new_data_json.relative_path;
                            var errorCode = 'ERR-ATMT-CONSUMER-0007';
                            threadInfo.threadProcessingInfo = errorMsg;
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, errorCode, errorMsg, error);
                        } else {
                            threadInfo.threadProcessingInfo = 'Updated TRN_ATTACHMENTS as No Image Data';
                        }
                        var errorMsg = 'There is No Image Data From TRN_ATTACHMENTS Table for Relative Path - ' + strMsg.new_data_json.relative_path;
                        var errorCode = 'ERR-ATMT-CONSUMER-0010';
                        var PrepareErrorInfoObj = {
                            errorMsg: errorMsg,
                            errorCode: errorCode
                        };
                        PrepareErrorInfo(res_cas_instance, tran_db_instance, solr_tran_atmt_instance, solr_fx_tran_instance, message, failureData, PrepareErrorInfoObj, MoveAtmtIntoSolrCB);
                    });
                }
                else {
                    var tranAtmtCoreObj = {};
                    tranAtmtCoreObj.objLogInfo = objLogInfo;
                    tranAtmtCoreObj.hst_trn_atmt_json = strMsg;
                    tranAtmtCoreObj.trna_data = PrepareMessageResult;
                    tranAtmtCoreObj.res_cas_instance = res_cas_instance;
                    tranAtmtCoreObj.tran_db_instance = tran_db_instance;
                    tranAtmtCoreObj.solr_tran_atmt_instance = solr_tran_atmt_instance;
                    tranAtmtCoreObj.solr_fx_tran_instance = solr_fx_tran_instance;
                    tranAtmtCoreObj.partition = message.partition;
                    tranAtmtCoreObj.offset = message.offset;
                    tranAtmtCoreObj.THREAD_INFO = threadInfo;
                    tranAtmtCoreObj.HEADERS = headers;
                    reqThreadHelper.ProduceTranAtmtData(tranAtmtCoreObj, function (tranCoreInfo) {
                        PrepareErrorInfo(res_cas_instance, tran_db_instance, solr_tran_atmt_instance, solr_fx_tran_instance, message, failureData, tranCoreInfo, MoveAtmtIntoSolrCB);

                        /* This code is for deleting the hst table data via DB sink connector by using kafka topic
                           if (message.topic == 'PRF.hst_trn_attachments') {
                                deleteHstSchema.payload.hta_id = strMsg.hta_id;
                                deleteHstSchema.schema.fields[0].field = 'hta_id';
                            } else {
                                deleteHstSchema.payload.HTA_ID = strMsg.hta_id;
                                deleteHstSchema.schema.fields[0].field = 'HTA_ID';
                            }
    
                            if (tranCoreInfo.status == 'SUCCESS') {
                                // Deleting Hst table Data only for the positive flow and it will be helpful for verify the data for negative cases
                                reqProducer.ProduceMessage(hstDeleteTopicName, null, null, function (res) {
                                    strMsg = {};
                                    PrepareErrorInfo(res_cas_instance, tran_db_instance, solr_tran_atmt_instance, solr_fx_tran_instance, message, failureData, tranCoreInfo, MoveAtmtIntoSolrCB);
                                }, deleteHstSchema);
    
                            } else {
                                PrepareErrorInfo(res_cas_instance, tran_db_instance, solr_tran_atmt_instance, solr_fx_tran_instance, message, failureData, tranCoreInfo, MoveAtmtIntoSolrCB);
    
                            } */
                    });
                }
            });
        } catch (error) {
            var errorMsg = 'Catch Error in MoveAtmtIntoSolr()';
            var errorCode = 'ERR-ATMT-CONSUMER-0011';
            reqInstanceHelper.PrintError(serviceName, objLogInfo, errorCode, errorMsg, error);
            var PrepareErrorInfoObj = {
                errorMsg: errorMsg,
                errorObj: error,
                errorCode: errorCode
            };
            PrepareErrorInfo(res_cas_instance, tran_db_instance, solr_tran_atmt_instance, solr_fx_tran_instance, message, failureData, PrepareErrorInfoObj, MoveAtmtIntoSolrCB);
        }

    }



    function PrepareErrorInfo(res_cas_instance, tran_db_instance, solr_tran_atmt_instance, solr_fx_tran_instance, message, pFailureData, pErrorInfo, PrepareErrorInfoCB) {
        try {
            var objLogInfo = pFailureData.objLogInfo;
            var errorMsg = '';
            var errorObj = '';
            var errorCode = '';
            var TRAN_ATMT_CORE = pErrorInfo.TRAN_ATMT_CORE || {};
            var FX_TRAN_CORE = pErrorInfo.FX_TRAN_CORE || {};
            var TRNA_DATA_TABLE = pErrorInfo.TRNA_DATA_TABLE || {};
            var TRN_ATTACHMENTS_TABLE = pErrorInfo.TRN_ATTACHMENTS_TABLE || {};

            // Catch Error Case or Failed to get Image Data based on Relative Path
            var catchErrorObj = pErrorInfo.errorObj || '';
            errorObj = catchErrorObj.stack || catchErrorObj;
            if (pErrorInfo.errorMsg) {
                errorMsg = pErrorInfo.errorMsg;
            }
            if (pErrorInfo.errorCode) {
                errorCode = pErrorInfo.errorCode;
            }
            // Gathering All the Insert/Update Status
            // TRAN_ATMT_CORE Status
            if (TRAN_ATMT_CORE.ERROR_OBJ) {
                errorObj = errorObj + ', ' + (TRAN_ATMT_CORE.ERROR_OBJ.stack || TRAN_ATMT_CORE.ERROR_OBJ);
            }
            if (TRAN_ATMT_CORE.ERROR_MSG) {
                errorMsg = errorMsg + ', ' + TRAN_ATMT_CORE.ERROR_MSG;
            }
            // FX_TRAN_CORE Status
            if (FX_TRAN_CORE.ERROR_OBJ) {
                errorObj = errorObj + ', ' + (FX_TRAN_CORE.ERROR_OBJ.stack || FX_TRAN_CORE.ERROR_OBJ);
            }
            if (FX_TRAN_CORE.ERROR_MSG) {
                errorMsg = errorMsg + ', ' + FX_TRAN_CORE.ERROR_MSG;
            }
            // TRNA_DATA_TABLE Status
            if (TRNA_DATA_TABLE.ERROR_OBJ) {
                errorObj = errorObj + ', ' + (TRNA_DATA_TABLE.ERROR_OBJ.stack || TRNA_DATA_TABLE.ERROR_OBJ);
            }
            if (TRNA_DATA_TABLE.ERROR_MSG) {
                errorMsg = errorMsg + ', ' + TRNA_DATA_TABLE.ERROR_MSG;
            }
            // TRN_ATTACHMENTS_TABLE Status
            if (TRN_ATTACHMENTS_TABLE.ERROR_OBJ) {
                errorObj = errorObj + ', ' + (TRN_ATTACHMENTS_TABLE.ERROR_OBJ.stack || TRN_ATTACHMENTS_TABLE.ERROR_OBJ);
            }
            if (TRN_ATTACHMENTS_TABLE.ERROR_MSG) {
                errorMsg = errorMsg + ', ' + TRN_ATTACHMENTS_TABLE.ERROR_MSG;
            }
        } catch (error) {
        }
        pFailureData.ERROR_OBJ = errorObj;
        pFailureData.ERROR_MSG = errorMsg;
        pFailureData.ERROR_CODE = errorCode;
        if (errorObj || errorMsg) {
            var errorExisted = false;
            // Retry Logic Applied Here
            // Checking the Current Error Info with the Predefined Errors From the Redis Service Parm
            for (let d = 0; d < redisRetryErrorList.length; d++) {
                const element = redisRetryErrorList[d];
                if (element && errorObj.toLowerCase().includes(element.toLowerCase())) {
                    errorExisted = true;
                }

            }
            if (errorExisted) { // Existed Case
                // if (redisRetryErrorList.indexOf(errorObj) > -1) { // Existed Case
                // Handling Retry Based on Retry Count and Error From Redis Param For Each Msg
                reqInstanceHelper.PrintInfo(serviceName, 'Redis Max Retry Count | ' + redisMaxRetryCount, objLogInfo);
                reqInstanceHelper.PrintInfo(serviceName, 'Current Failure Retry Count | ' + pFailureData.RETRY_COUNT, objLogInfo);
                if (redisMaxRetryCount > pFailureData.RETRY_COUNT) {
                    pFailureData.RETRY_COUNT++;// Increament By 1
                    reqInstanceHelper.PrintInfo(serviceName, 'Current Retry Interval  | ' + redisMaxRetryInterval + ' Sec', objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, 'Retry Process Will be Started After ' + redisMaxRetryInterval + ' Sec', objLogInfo);
                    setTimeout(() => {
                        reqInstanceHelper.PrintInfo(serviceName, 'Retry Process Started For Failed Data...', objLogInfo);
                        MoveAtmtIntoSolr(JSON.parse(JSON.stringify(pFailureData.HST_DATA)), res_cas_instance, tran_db_instance, solr_tran_atmt_instance, solr_fx_tran_instance, message, pFailureData, PrepareErrorInfoCB);
                    }, (redisMaxRetryInterval * 1000));
                } else {
                    reqInstanceHelper.PrintInfo(serviceName, 'Retry Count Exceeded For Failed Data and Recovery Process Initiated...', objLogInfo);
                    reqRecoveryLog.HandleConsumerFailures(pFailureData, PrepareErrorInfoCB);
                }
            } else {
                reqInstanceHelper.PrintInfo(serviceName, 'Current Error Info is Not Updated in the Redis Service Param and The Error - ' + errorObj, objLogInfo);
                reqRecoveryLog.HandleConsumerFailures(pFailureData, PrepareErrorInfoCB);
            }
        } else {
            if (pFailureData.RETRY_COUNT > 0) { // Checking the current record which is processed by the Retry Process
                reqInstanceHelper.PrintInfo(serviceName, 'Successfully Processed the Failed Record', objLogInfo);
            }
            PrepareErrorInfoCB();
        }
    }
}

function GetObjLogInfo() {
    try {
        return reqLogWriter.GetLogInfo('ATTACHMENT_CONSUMER', 'ATTACHMENT_CONSUMER_PROCESS', 'ATTACHMENT_CONSUMER_ACTION', logFilePath)
    } catch (error) {
        return {};
    }
}


module.exports = {
    StartConsuming: startConsuming
};
/******** End of File **********/