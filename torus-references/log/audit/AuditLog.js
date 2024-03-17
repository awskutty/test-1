/**
 @Decsription      : To handle transaction db operations
 @Last_Error_Code - ERR_AUDITLOG_0002
 */

// Require dependencies
var reqAsync = require('async');
var jsonl = require('json-literal');
var reqMoment = require('moment');
var reqSolrInstance = require('../../instance/SolrInstance');
var reqDateFormatter = require('../../common/dateconverter/DateFormatter');
var reqInstanceHelper = require('../../common/InstanceHelper');
var reqTranDBInstance = require('../../instance/TranDBInstance');
var reqDBInstance = require('../../instance/DBInstance');
var reqProducer;

// client connects to solr host
var mSolrClient = null;
var mVerSolrClient = null;

// global variables Initialization
var strAppID = '';
var strHandlerCode = '';
var strAction = '';
var strProcess = '';
var mHeaders = {};
// var objLosgInfo = null;
var serviceName = 'AuditLog';

var serviceModel;
var isLatestPlatformVersion = false;


function _TraceError(pError, objLogInfo) {
    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', pError);
}

function _AuditLog(pAuditData, objLogInfo, pCallback) {
    if (pAuditData) {
        mHeaders = pAuditData.headers ? pAuditData.headers : {};
    }
    /* pAuditData contains
     {
        headers:"routingkey: clt-1304~app-109~tnt-0~env-dev",
        solrData : []
    } */
    var solrData = pAuditData.solrData || [];
    var solrStatus = {
        solrInsertStatus: true,
        error: '',
        auditLogCoreData: [],
        auditVersionLogCoreData: [],
        kafkaConnectSolrData: []
    };
    var objAuditLog = {};
    try {
        // reqAsync.forEach(solrData, function (pTranData, solrObjCB) {
        reqAsync.forEachOfSeries(solrData, function (pTranData, i, solrObjCB) {
            strAppID = pTranData['AppId'];
            strHandlerCode = (pTranData['HandlerCode']) ? pTranData['HandlerCode'] : '';
            strAction = (pTranData['Action']) ? pTranData['Action'] : '';
            strProcess = (pTranData['MenuItemDesc']) ? pTranData['MenuItemDesc'] : '';

            var objTranData = pTranData['TranData'];
            var prevData = objTranData.old_data;
            try {
                var strDTTInfo = _GetTargetTableAndKeyColumn(objLogInfo, [pTranData['Relation']], objTranData['DTT_Code'], null);
                var arrDttInfo = strDTTInfo.split(',');
                var strKeyColumn = arrDttInfo[1];
                var strDTTDesc = arrDttInfo[2];
                var arrStaticColumn = [];
                _AddStaticColumns(strKeyColumn, arrStaticColumn);
                if (prevData) {
                    // __PrintInfo('Previous data - ' + prevData);
                    reqAsync.forEachOfSeries(objTranData.Items, function (Item, i, CallbackSer) {
                        // reqAsync.forEach(objTranData.Items, function (Item, CallbackSer) {
                        try {
                            var strPrevJson = prevData;
                            var objPrevJson = reqInstanceHelper.ArrKeyToUpperCase([jsonl.parse(strPrevJson)])[0];

                            // Assign Loginfo detail
                            _AssignLogInfoDetail(objAuditLog, Item, strKeyColumn);
                            // Compare current row with previous row, if any changes found put on SOLR and AUDIT_LOG
                            _CompareAndSaveJson(objLogInfo, objAuditLog, Item, objPrevJson, arrStaticColumn, strKeyColumn, strDTTDesc, 0, Object.keys(Item), solrStatus, function callbackCompareAndSave(pStatus) {
                                try {
                                    if (pStatus) {
                                        var data = {
                                            DT_CODE: Item['DT_CODE'],
                                            DT_DESCRIPTION: Item['DT_DESCRIPTION'],
                                            DTT_CODE: Item['DTT_CODE'],
                                            DTT_DESCRIPTION: Item['DTT_DESCRIPTION'],
                                            TRN_ID: Item[strKeyColumn],
                                            VERSION_NO: Item['VERSION_NO'],
                                            CREATED_BY: Item['MODIFIED_BY_NAME'] ? Item['MODIFIED_BY_NAME'] : null,
                                            CREATED_DATE: Item['MODIFIED_DATE'] ? Item['MODIFIED_DATE'] : null,
                                            PRCT_ID: Item['PRCT_ID'],
                                            // OLD_DATA: JSON.stringify(objPrevJson),
                                            // NEW_DATA: JSON.stringify(Item),
                                            APP_ID: Item['APP_ID'],
                                            TENANT_ID: Item['TENANT_ID']
                                        };
                                        data.ROUTINGKEY = Item['ROUTINGKEY'];
                                        data.CREATED_DATE_UTC = Item.MODIFIED_DATE_UTC || Item.CREATED_DATE_UTC;
                                        data.CREATED_BY_NAME = Item['MODIFIED_BY_NAME'] || Item['CREATED_BY_NAME'];
                                        data.CREATED_CLIENTIP = Item['MODIFIED_CLIENTIP'] || Item['CREATED_CLIENTIP'];
                                        data.CREATED_TZ = Item['MODIFIED_TZ'] || Item['CREATED_TZ'];
                                        data.CREATED_TZ_OFFSET = Item['MODIFIED_TZ_OFFSET'] || Item['CREATED_TZ_OFFSET'];
                                        data.CREATED_BY_SESSIONID = Item['MODIFIED_BY_SESSIONID'] || Item['CREATED_BY_SESSIONID'];

                                        data.id = data.DTT_CODE + ' - ' + data.TRN_ID + ' - ' + data.VERSION_NO; // Only for TRAN_VERSION solr core
                                        if (!data.DT_DESCRIPTION) {
                                            data.DT_DESCRIPTION = Item.DT_CODE;
                                        }
                                        if (!data.DTT_DESCRIPTION) {
                                            data.DTT_DESCRIPTION = strDTTDesc || Item.DTT_CODE;
                                        }
                                        if (data.VERSION_NO == 1 || data.VERSION_NO == "1") {
                                            data.CREATED_BY = Item['CREATED_BY_NAME'] ? Item['CREATED_BY_NAME'] : null;
                                            data.CREATED_DATE = Item['CREATED_DATE'] ? Item['CREATED_DATE'] : null;
                                        }
                                        PrepareModifiedColumns(data, Item, objPrevJson, objLogInfo);
                                        // Write on version solr with created by name and created_date
                                        // solrStatus.auditVersionLogCoreData.push(data);

                                        var solrData = {
                                            kafka_topic_name: 'TRAN_VERSION',
                                            solr_data: data
                                        };
                                        solrStatus.kafkaConnectSolrData.push(solrData);
                                        // solrData = {};
                                        // objPrevJson = {};
                                        // data = {};
                                        // Item = {};
                                        CallbackSer(true, null);
                                    } else
                                        CallbackSer(pStatus, null);
                                } catch (ex) {
                                    _TraceError(ex, objLogInfo);
                                    CallbackSer(pStatus, null);
                                }
                            });
                        } catch (ex) {
                            _TraceError(ex, objLogInfo);
                            CallbackSer(false, null);
                        }
                    },
                        function () {
                            // pTranData = {};
                            solrObjCB();
                        }); // end of async
                } else if (!prevData) { // Insert into Audit log table
                    _HandleNewData(objLogInfo, objAuditLog, objTranData, arrStaticColumn, strKeyColumn, strDTTDesc, solrStatus, function callbackHandleNewData(pStatus) {
                        // pTranData = {};
                        solrObjCB();
                    });

                } else
                    pCallback(false, solrStatus);
            } catch (ex) {
                _TraceError(ex, objLogInfo);
                pCallback(false, solrStatus);
            }
        },
            function () {
                // Producing to Tran Version Detail Solr Core Via Kafka Connect to Solr
                if (pAuditData && pAuditData.sendMsgKafkaTopic) {
                    pCallback(true, solrStatus);
                    // solrStatus = {};
                }
                else {
                    // Adding Docs To Solr
                    _WriteToSolr(objLogInfo, solrStatus, function (logCoreInsertStatus) {
                        if (logCoreInsertStatus) {
                            _WriteToVersionSolr(objLogInfo, solrStatus, function (versionCoreInsertStatus) {
                                pCallback(versionCoreInsertStatus, solrStatus);
                                // solrStatus = {};
                            });
                        } else {
                            pCallback(false, solrStatus);
                            // solrStatus = {};
                        }
                    });
                }
            });
    } catch (ex) {
        _ErrorHandler(objLogInfo, 'Error on AuditLog() ', ex.stack, '');
        pCallback(false, solrStatus);
        // solrStatus = {};
    }
}

// Trying to Reduce the TRAN_VERSION solr Core Size by Collecting/Adding only the modified Columns from the New Data JSON/ Old Data JSOn
function PrepareModifiedColumns(pAlterdJson, pNewJson, POldJson, pLogInfo) {
    try {
        var alteredOldJson = {};
        var alteredNewJson = {};
        if (POldJson) {
            // Get the JSON Diff Columns only
            var newDataJsonkeys = Object.keys(pNewJson);
            for (var i = 0; i < newDataJsonkeys.length; i++) {
                var newDataJsonkey = newDataJsonkeys[i];
                if (pNewJson[newDataJsonkey] != POldJson[newDataJsonkey]) {
                    console.log(newDataJsonkey + " value changed from '" + pNewJson[newDataJsonkey] + "' to '" + POldJson[newDataJsonkey] + "'");
                    alteredNewJson[newDataJsonkey] = pNewJson[newDataJsonkey];
                    alteredOldJson[newDataJsonkey] = POldJson[newDataJsonkey];
                }
            }

            pAlterdJson.OLD_DATA = JSON.stringify(alteredOldJson);
            pAlterdJson.NEW_DATA = JSON.stringify(alteredNewJson);


        } else {
            // there is no old json, hence adding full json
            pAlterdJson.OLD_DATA = JSON.stringify(POldJson);
            pAlterdJson.NEW_DATA = JSON.stringify(pNewJson);
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR_AUDITLOG_0002', 'Catch error in PrepareModifiedColumns()', error);
    }

}


function _AssignLogInfoDetail(pAuditLogInfo, pCurrentRow, pKeyColumn) {
    pAuditLogInfo.RECORD_ID = pCurrentRow[pKeyColumn].toString();
    pAuditLogInfo.USER_ID = ((pCurrentRow['MODIFIED_BY'] == undefined || pCurrentRow['MODIFIED_BY'] == '') ? pCurrentRow['CREATED_BY'] : pCurrentRow['MODIFIED_BY']);
    pAuditLogInfo.USER_NAME = ((pCurrentRow['MODIFIED_BY_NAME'] == undefined || pCurrentRow['MODIFIED_BY_NAME'] == '') ? pCurrentRow['CREATED_BY_NAME'] : pCurrentRow['MODIFIED_BY_NAME']);
    pAuditLogInfo.PRCT_ID = pCurrentRow['PRCT_ID'];
    pAuditLogInfo.DT_DESCRIPTION = (pCurrentRow['DT_DESCRIPTION'] == undefined) ? '' : pCurrentRow['DT_DESCRIPTION'];
    pAuditLogInfo.DT_CODE = (pCurrentRow['DT_CODE'] == undefined) ? '' : pCurrentRow['DT_CODE'];
    pAuditLogInfo.DTT_DESCRIPTION = (pCurrentRow['DTT_DESCRIPTION'] == undefined) ? '' : pCurrentRow['DTT_DESCRIPTION'];
    pAuditLogInfo.DTT_CODE = (pCurrentRow['DTT_CODE'] == undefined) ? '' : pCurrentRow['DTT_CODE'];
    pAuditLogInfo.APP_ID = strAppID;
    pAuditLogInfo.CREATED_BY = pCurrentRow['CREATED_BY'];
    pAuditLogInfo.TENANT_ID = pCurrentRow['TENANT_ID'];
    pAuditLogInfo.CREATED_DATE = pCurrentRow['MODIFIED_DATE'] || pCurrentRow['CREATED_DATE'];

    pAuditLogInfo.ROUTINGKEY = pCurrentRow['ROUTINGKEY'];
    pAuditLogInfo.CREATED_DATE_UTC = pCurrentRow['MODIFIED_DATE_UTC'] || pCurrentRow['CREATED_DATE_UTC'];
    pAuditLogInfo.CREATED_BY_NAME = pCurrentRow['MODIFIED_BY_NAME'] || pCurrentRow['CREATED_BY_NAME'];
    pAuditLogInfo.CREATED_CLIENTIP = pCurrentRow['MODIFIED_CLIENTIP'] || pCurrentRow['CREATED_CLIENTIP'];
    pAuditLogInfo.CREATED_TZ = pCurrentRow['MODIFIED_TZ'] || pCurrentRow['CREATED_TZ'];
    pAuditLogInfo.CREATED_TZ_OFFSET = pCurrentRow['MODIFIED_TZ_OFFSET'] || pCurrentRow['CREATED_TZ_OFFSET'];
    pAuditLogInfo.CREATED_BY_SESSIONID = pCurrentRow['MODIFIED_BY_SESSIONID'] || pCurrentRow['CREATED_BY_SESSIONID'];
}

function _HandleNewData(objLogInfo, objAuditLog, objTranData, arrStaticColumn, strKeyColumn, strDTTDesc, pSolrStatus, pCallback) {
    try {
        var DttDesc = strDTTDesc;
        var DtCode = objTranData.DT_Code;
        reqAsync.forEachOfSeries(objTranData.Items, function (Item, i, CallbackSer) {
            // reqAsync.forEach(objTranData.Items, function (Item, CallbackSer) {
            try {
                // Assign Loginfo detail
                _AssignLogInfoDetail(objAuditLog, Item, strKeyColumn);
                _CompareAndSaveJson_NewData(objLogInfo, objAuditLog, Item, arrStaticColumn, strKeyColumn, strDTTDesc, 0, Object.keys(Item), pSolrStatus, function callbackCompareAndSave(pStatus1) {
                    try {
                        if (pStatus1) {
                            var data = {
                                DT_CODE: Item['DT_CODE'],
                                //DT_DESCRIPTION: Item['DT_DESCRIPTION'],
                                DTT_CODE: Item['DTT_CODE'],
                                // DTT_DESCRIPTION: Item['DTT_DESCRIPTION'] || DttDesc,
                                TRN_ID: Item[strKeyColumn],
                                VERSION_NO: Item['VERSION_NO'],
                                CREATED_BY: Item['MODIFIED_BY_NAME'] ? Item['MODIFIED_BY_NAME'] : null,
                                CREATED_DATE: Item['MODIFIED_DATE'] ? Item['MODIFIED_DATE'] : null,
                                PRCT_ID: Item['PRCT_ID'],
                                OLD_DATA: null,
                                NEW_DATA: JSON.stringify(Item),
                                APP_ID: Item['APP_ID'],
                                TENANT_ID: Item['TENANT_ID']
                            };
                            data.ROUTINGKEY = Item['ROUTINGKEY'];
                            data.CREATED_DATE_UTC = Item.MODIFIED_DATE_UTC || Item.CREATED_DATE_UTC;
                            data.CREATED_BY_NAME = Item['MODIFIED_BY_NAME'] || Item['CREATED_BY_NAME'];
                            data.CREATED_CLIENTIP = Item['MODIFIED_CLIENTIP'] || Item['CREATED_CLIENTIP'];
                            data.CREATED_TZ = Item['MODIFIED_TZ'] || Item['CREATED_TZ'];
                            data.CREATED_TZ_OFFSET = Item['MODIFIED_TZ_OFFSET'] || Item['CREATED_TZ_OFFSET'];
                            data.CREATED_BY_SESSIONID = Item['MODIFIED_BY_SESSIONID'] || Item['CREATED_BY_SESSIONID'];
                            data.id = data.DTT_CODE + ' - ' + data.TRN_ID + ' - ' + data.VERSION_NO; // Only for TRAN_VERSION solr core
                            if (Item['DTT_DESCRIPTION']) {
                                data.DTT_DESCRIPTION = Item['DTT_DESCRIPTION'];
                            } else {
                                data.DTT_DESCRIPTION = DttDesc;
                            }

                            if (Item['DT_DESCRIPTION']) {
                                data.DT_DESCRIPTION = Item['DT_DESCRIPTION'];
                            } else {
                                data.DT_DESCRIPTION = DtCode;
                            }
                            if (data.VERSION_NO == 1 || data.VERSION_NO == "1") {
                                data.CREATED_BY = Item['CREATED_BY_NAME'] ? Item['CREATED_BY_NAME'] : null;
                                data.CREATED_DATE = Item['CREATED_DATE'] ? Item['CREATED_DATE'] : null;
                            }
                            var solrData = {
                                kafka_topic_name: 'TRAN_VERSION',
                                solr_data: data
                            };
                            pSolrStatus.kafkaConnectSolrData.push(solrData);
                            // Write on version solr
                            // pSolrStatus.auditVersionLogCoreData.push(data);
                            Item = {};
                            solrData = {};
                            data = {};
                            CallbackSer(true, null);
                        } else
                            CallbackSer(pStatus1, null);
                    } catch (ex) {
                        _TraceError(ex, objLogInfo);
                        CallbackSer(pStatus1, null);
                    }
                });
            } catch (ex) {
                _TraceError(ex, objLogInfo);
                CallbackSer(false, null);
            }
        },
            function () {
                pCallback(pSolrStatus.solrInsertStatus, pSolrStatus);
            }); // end of async )
    } catch (ex) {
        _TraceError(ex, objLogInfo);
        pCallback(null, pSolrStatus);
    }
}

function ProducingIntoTranJourneyTopic(objLogInfo, pArrAuditLog, pTranData, pKeyColumn, ProducingIntoTranJourneyTopicCB) {
    try {
        var isTenantMultiThreaded = objLogInfo.IS_TENANT_MULTI_THREADED;
        var routingkey = objLogInfo.ROUTINGKEY;
        var statusColumnChanged = false;
        var processStatusColumnChanged = false;
        var ColumnName = '';
        for (let c = 0; c < pArrAuditLog.length; c++) {
            const element = pArrAuditLog[c];
            var uniqInfoFromAuditLog = element.DT_CODE + '_' + element.DTT_CODE + '_' + element.RECORD_ID;
            var uniqInfoCurrentTran = pTranData.DT_CODE + '_' + pTranData.DTT_CODE + '_' + pTranData[pKeyColumn];
            if (uniqInfoFromAuditLog == uniqInfoCurrentTran) {
                if (element.COLUMN_NAME == 'STATUS') {
                    statusColumnChanged = true;
                    ColumnName = 'STATUS';
                }
                if (element.COLUMN_NAME == 'PROCESS_STATUS') {
                    processStatusColumnChanged = true;
                    ColumnName = 'PROCESS_STATUS';
                }
                if (c == (pArrAuditLog.length - 1)) {
                    // Final Action
                    if ((processStatusColumnChanged || statusColumnChanged)) {
                        if (processStatusColumnChanged && statusColumnChanged) { //Both Case
                            reqInstanceHelper.PrintInfo(serviceName, '************************************************', objLogInfo);
                            reqInstanceHelper.PrintInfo(serviceName, 'Producing Data Into TRAN_JOURNEY_DETAIL TOPIC', objLogInfo);
                            reqInstanceHelper.PrintInfo(serviceName, '************************************************', objLogInfo);
                            ColumnName = 'BOTH';
                            reqInstanceHelper.PrintInfo(serviceName, 'Both STATUS and PROCESS_STATUS Columns are Changed', objLogInfo);
                        } else if (ColumnName == 'STATUS') {
                            reqInstanceHelper.PrintInfo(serviceName, 'STATUS Column Changed', objLogInfo);
                        } else {
                            reqInstanceHelper.PrintInfo(serviceName, 'PROCESS_STATUS Column Changed', objLogInfo);
                        }
                        reqProducer = require('../../common/Producer');
                        var tranJourneyTimeKafkaTopic = 'TRAN_JOURNEY_DETAIL';
                        /* if (isTenantMultiThreaded) {
                            tranJourneyTimeKafkaTopic = tranJourneyTimeKafkaTopic + '_' + routingkey;
                        } 
                        tranJourneyTimeKafkaTopic = tranJourneyTimeKafkaTopic.replace(/~/g, '_').toUpperCase(); // If Replace is Not Done then It will not create a Kfka Topic
                       */
                        var tranJourneyTimeKafkaTopicReqObj = {
                            DT_CODE: pTranData.DT_CODE,
                            DTT_CODE: pTranData.DTT_CODE,
                            DT_DESCRIPTION: pTranData.DT_DESCRIPTION,
                            DTT_DESCRIPTION: pTranData.DTT_DESCRIPTION,
                            KEY_COLUMN: pKeyColumn,
                            COLUMN_NAME: ColumnName,
                            TRAN_ID: pTranData[pKeyColumn],
                            VERSION_NO: pTranData.VERSION_NO,
                            TRAN_DATA: JSON.stringify(pTranData)
                        };
                        reqInstanceHelper.PrintInfo(serviceName, 'TRAN informations', objLogInfo);
                        reqInstanceHelper.PrintInfo(serviceName, 'DT_DESCRIPTION - ' + tranJourneyTimeKafkaTopicReqObj.DT_DESCRIPTION, objLogInfo);
                        reqInstanceHelper.PrintInfo(serviceName, 'DTT_DESCRIPTION - ' + tranJourneyTimeKafkaTopicReqObj.DTT_DESCRIPTION, objLogInfo);
                        reqInstanceHelper.PrintInfo(serviceName, 'TRAN_ID - ' + tranJourneyTimeKafkaTopicReqObj.TRAN_ID, objLogInfo);
                        reqInstanceHelper.PrintInfo(serviceName, 'DT_CODE - ' + tranJourneyTimeKafkaTopicReqObj.DT_CODE, objLogInfo);
                        reqInstanceHelper.PrintInfo(serviceName, 'DTT_CODE - ' + tranJourneyTimeKafkaTopicReqObj.DTT_CODE, objLogInfo);
                        reqInstanceHelper.PrintInfo(serviceName, 'VERSION_NO - ' + tranJourneyTimeKafkaTopicReqObj.VERSION_NO, objLogInfo);
                        reqInstanceHelper.PrintInfo(serviceName, 'Producing Data into Kafka Topic - ' + JSON.stringify(tranJourneyTimeKafkaTopicReqObj), '');

                        reqInstanceHelper.PrintInfo(serviceName, 'ROUTINGKEY - ' + routingkey, objLogInfo);
                        reqInstanceHelper.PrintInfo(serviceName, 'Kafka Topic Name - ' + tranJourneyTimeKafkaTopic, objLogInfo);
                        if (isTenantMultiThreaded && !routingkey) {
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_AUDITLOG_0001', 'Tenant Multi Thread is Enabled. But There is No ROUTINGKEY in the TRAN DATA', '');
                        }
                        var kafkaTopicData = { HST_DATA: tranJourneyTimeKafkaTopicReqObj, ROUTING_KEY: routingkey };
                        reqProducer.ProduceMessage(tranJourneyTimeKafkaTopic, kafkaTopicData, null, function (response) {
                            if (ProducingIntoTranJourneyTopicCB) {
                                ProducingIntoTranJourneyTopicCB();
                            }
                        });
                    }
                }
            }

        }

    } catch (error) {

    }
}

function _CompareAndSaveJson(objLogInfo, pAuditLogInfo, pCurrentRow, pPrevRow, pStaticColumn, pKeyColumn, pDTTDesc, pIndex, pKeys, pSolrStatus, pCallback) {
    try {
        if (pStaticColumn.indexOf(pKeys[pIndex]) <= 0) {
            if (pCurrentRow[pKeys[pIndex]] != pPrevRow[pKeys[pIndex]]) {
                __PrintInfo('Comparing key values..', objLogInfo);
                __PrintInfo('ChangedKey ' + pKeys[pIndex] + ', OldValue : ' + pPrevRow[pKeys[pIndex]] + ', NewValue : ' + pCurrentRow[pKeys[pIndex]], objLogInfo);
                __PrintInfo('===================================================================', objLogInfo);
                _PrepareAuditLogMessage(objLogInfo, JSON.stringify(pAuditLogInfo), pKeys[pIndex], pCurrentRow[pKeys[pIndex]], pPrevRow[pKeys[pIndex]], pCurrentRow, pKeyColumn, pDTTDesc, pSolrStatus, function callbackPrepareAuditLogMessage(pStatus) {
                    if (pStatus) // if Status is true, increase the index and again call the same process
                        pIndex = pIndex + 1;
                    if (pKeys.length == pIndex || !pStatus) {
                        ProducingIntoTranJourneyTopic(objLogInfo, pSolrStatus.auditLogCoreData, pCurrentRow, pKeyColumn);
                        pCallback(pStatus);
                    }
                    else {
                        _CompareAndSaveJson(objLogInfo, pAuditLogInfo, pCurrentRow, pPrevRow, pStaticColumn, pKeyColumn, pDTTDesc, pIndex, pKeys, pSolrStatus, pCallback);
                    }
                });
            } else {
                pIndex = pIndex + 1;
                if (pKeys.length == pIndex) {
                    ProducingIntoTranJourneyTopic(objLogInfo, pSolrStatus.auditLogCoreData, pCurrentRow, pKeyColumn, function (params) {
                    });
                    pCallback(true);
                }
                else {
                    _CompareAndSaveJson(objLogInfo, pAuditLogInfo, pCurrentRow, pPrevRow, pStaticColumn, pKeyColumn, pDTTDesc, pIndex, pKeys, pSolrStatus, pCallback);
                }
            }
        } else {
            pIndex = pIndex + 1;
            if (pKeys.length == pIndex)
                pCallback(true);
            else
                _CompareAndSaveJson(objLogInfo, pAuditLogInfo, pCurrentRow, pPrevRow, pStaticColumn, pKeyColumn, pDTTDesc, pIndex, pKeys, pSolrStatus, pCallback);
        }
    } catch (ex) {
        _ErrorHandler(objLogInfo, 'Error on _CompareAndSaveJson() ', ex.stack, '');
        pCallback(false);
    }
}

function _CompareAndSaveJson_NewData(objLogInfo, pAuditLogInfo, pCurrentRow, pStaticColumn, pKeyColumn, pDTTDesc, pIndex, pKeys, pSolrStatus, pCallback) {
    try {
        __PrintInfo('Comparing key values..', objLogInfo);
        if (pStaticColumn.indexOf(pKeys[pIndex]) <= 0) {
            __PrintInfo('ChangedKey ' + pKeys[pIndex] + ', No OldValue , NewValue : ' + pCurrentRow[pKeys[pIndex]], objLogInfo);
            _PrepareAuditLogMessage(objLogInfo, JSON.stringify(pAuditLogInfo), pKeys[pIndex], pCurrentRow[pKeys[pIndex]], '', pCurrentRow, pKeyColumn, pDTTDesc, pSolrStatus, function callbackPrepareAuditLogMessage(pStatus) {
                if (pStatus) // if Status is true, increase the index and again call the same process
                    pIndex = pIndex + 1;
                if (pKeys.length == pIndex || !pStatus) {
                    ProducingIntoTranJourneyTopic(objLogInfo, pSolrStatus.auditLogCoreData, pCurrentRow, pKeyColumn, function (params) {
                    });
                    pCallback(pStatus);
                }
                else {
                    _CompareAndSaveJson_NewData(objLogInfo, pAuditLogInfo, pCurrentRow, pStaticColumn, pKeyColumn, pDTTDesc, pIndex, pKeys, pSolrStatus, pCallback);
                }
            });
        } else {
            pIndex = pIndex + 1;
            if (pKeys.length == pIndex) {
                ProducingIntoTranJourneyTopic(objLogInfo, pSolrStatus.auditLogCoreData, pCurrentRow, pKeyColumn, function (params) {
                });
                pCallback(true);
            }
            else {
                _CompareAndSaveJson_NewData(objLogInfo, pAuditLogInfo, pCurrentRow, pStaticColumn, pKeyColumn, pDTTDesc, pIndex, pKeys, pSolrStatus, pCallback);
            }
        }

    } catch (ex) {
        _ErrorHandler(objLogInfo, 'Error on _CompareAndSaveJson_NewData() ', ex.stack, '');
        pCallback(false);
    }
}

function _GetTargetTableAndKeyColumn(objLogInfo, pRelationJson, pDTTCode, pLogInfo) {
    try {
        var tmpStr = '';
        for (var i = 0; i < pRelationJson.length; i++) {
            tmpStr = _GetHierarchyDTT(objLogInfo, pRelationJson[i], pDTTCode, pLogInfo);
            if (tmpStr != undefined && tmpStr != '')
                break;
        }
        return tmpStr;
    } catch (ex) {
        _TraceError(ex, objLogInfo);
    }
}

function _GetHierarchyDTT(objLogInfo, pRelationJson, pDTTCode, pLogInfo) {
    try {
        var objRelationJson = pRelationJson;
        var strTargetTable = '';
        var strKeyColumn = '';
        var strDTTDescription = '';
        var strDTTCategory = '';
        // Find targettable and keycolumn for selected DTTCode
        if (objRelationJson.DTT_CODE == pDTTCode) {
            strTargetTable = objRelationJson['TARGET_TABLE'];
            strKeyColumn = objRelationJson['PRIMARY_COLUMN'];
            strDTTDescription = objRelationJson['DTT_DESCRIPTION'];
            strDTTCategory = objRelationJson['CATEGORY'];
            return strTargetTable + ',' + strKeyColumn + ',' + strDTTDescription + ',' + strDTTCategory;
        }

        // find on child dtt relation
        for (var i = 0; i < objRelationJson.CHILD_DTT_RELEATIONS.length; i++) {
            if (objRelationJson.CHILD_DTT_RELEATIONS[i].DTT_CODE == pDTTCode) {
                strTargetTable = objRelationJson.CHILD_DTT_RELEATIONS[i]['TARGET_TABLE'];
                strKeyColumn = objRelationJson.CHILD_DTT_RELEATIONS[i]['PRIMARY_COLUMN'];
                strDTTDescription = objRelationJson.CHILD_DTT_RELEATIONS[i]['DTT_DESCRIPTION'];
                strDTTCategory = objRelationJson.CHILD_DTT_RELEATIONS[i]['CATEGORY'];
                return strTargetTable + ',' + strKeyColumn + ',' + strDTTDescription + ',' + strDTTCategory;
            }
            _GetHierarchyDTT(objLogInfo, objRelationJson.CHILD_DTT_RELEATIONS[i], pDTTCode, pLogInfo);
        }
    } catch (ex) {
        _ErrorHandler(objLogInfo, 'Error on finding targettable and keycolumn ', ex, 'ERR-DB-50001');
    }
}

function _AddStaticColumns(pKeyColumn, pArrStaticColumn) {
    pArrStaticColumn.push("Key_Value");
    pArrStaticColumn.push(pKeyColumn);
}

function _PrepareAuditLogMessage(objLogInfo, pAuditLogInfo, pColumnName, pNewValue, pOldValue, pTranData, pKeyColumn, pDTTDesc, pSolrStatus, pCallback) {
    try {
        var objAuditLog = JSON.parse(pAuditLogInfo);
        if (!objAuditLog.DT_DESCRIPTION) {
            objAuditLog.DT_DESCRIPTION = pTranData.DT_CODE;
        }
        if (!objAuditLog.DTT_DESCRIPTION) {
            objAuditLog.DTT_DESCRIPTION = pDTTDesc || pTranData.DTT_CODE;
        }
        objAuditLog.COLUMN_NAME = pColumnName;
        objAuditLog.OLD_VALUE = (pOldValue != '' && pOldValue != null && pOldValue != undefined) ? pOldValue.toString() : '';
        objAuditLog.NEW_VALUE = (pNewValue != '' && pNewValue != null && pNewValue != undefined) ? pNewValue.toString() : '';
        objAuditLog.HANDLER_CODE = strHandlerCode;
        objAuditLog.ACTION = strAction;
        objAuditLog.PROCESS = strProcess;
        objAuditLog.VERSION_NO = pTranData['VERSION_NO'];
        objAuditLog.id = pTranData.DTT_CODE + ' - ' + pTranData[pKeyColumn] + ' - ' + pTranData.VERSION_NO + ' - ' + pColumnName; // Only for TRAN_VERSION_DETAIL solr core
        // pTranData
        if (pTranData['VERSION_NO'] == 1 && objAuditLog.NEW_VALUE == '' || objAuditLog.NEW_VALUE == 'null') {
            __PrintInfo("'VERSION_NO' == 1 && NEW_VALUE == '' , No solr log", objLogInfo);
            pCallback(true);
        } else {
            // __PrintInfo('Prepared Auditlog Message ' + JSON.stringify(objAuditLog));
            /* var solrData = {
                kafka_topic_name: 'TRAN_VERSION_DETAIL',
                solr_data: objAuditLog
            };
            pSolrStatus.kafkaConnectSolrData.push(solrData); */
            pSolrStatus.auditLogCoreData.push(objAuditLog);
            // solrData = {};
            // objAuditLog = {};
            // pAuditLogInfo = {};
            pCallback(true);
        }
    } catch (ex) {
        _ErrorHandler(objLogInfo, 'Error on _PrepareAuditLogMessage() ', ex.stack, '');
        pCallback(false);
    }
}

function _WriteToSolr(objLogInfo, pSolrStatus, pCallback) {
    try {
        // pSolrStatus Contains Solr Docs
        //Solr Insert via SolrClient
        var solrDocs = pSolrStatus.auditLogCoreData || [];
        if (solrDocs.length) {
            reqSolrInstance.SolrInsert(mSolrClient, solrDocs, new Object(), function callbackSolrAdd(err, response) {
                if (err) {
                    _ErrorHandler(objLogInfo, 'Error in _WriteToSolr function', err, '');
                    pSolrStatus.error = err;
                    pSolrStatus.solrInsertStatus = false;
                    pCallback(false);
                } else {
                    pSolrStatus.solrInsertStatus = true;
                    __PrintInfo('Successfully updated on Solr Audit Log Core', objLogInfo);
                    pCallback(true);
                }
            });
        } else {
            pCallback(true);
        }
    } catch (ex) {
        _TraceError(ex, objLogInfo);
        pCallback(false);
    }
}

function _WriteToVersionSolr(objLogInfo, pSolrStatus, pCallback) {
    try {
        // pSolrStatus Contains Solr Docs
        var solrDocs = pSolrStatus.auditVersionLogCoreData || [];
        var pMessage = {};
        if (solrDocs.length) {
            for (var a = 0; a < solrDocs.length; a++) {
                pMessage = solrDocs[a];
                //Solr Insert via SolrClient
                if (pMessage.CREATED_DATE == '00-00-0000') {
                    pMessage.CREATED_DATE = null;
                }
            }
            reqSolrInstance.SolrInsert(mVerSolrClient, solrDocs, new Object(), function callbackSolrAdd(err, response) {
                if (err) {
                    pSolrStatus.error = err;
                    pSolrStatus.solrInsertStatus = false;
                    _ErrorHandler(objLogInfo, 'Error in _WriteToVersionSolr function', err.stack, '');
                    pCallback(false, err.stack);
                } else {
                    pSolrStatus.solrInsertStatus = true;
                    __PrintInfo('Successfully updated on Solr Audit Log Version Core', objLogInfo);
                    pCallback(true, '');
                }
            });
        } else {
            pCallback(true, '');
        }
    } catch (ex) {
        _TraceError(ex, objLogInfo);
        pCallback(false);
    }
}


function _ErrorHandler(objLogInfo, pMessage, pError, pErrorCode) {
    reqInstanceHelper.PrintError(serviceName, objLogInfo, pMessage, pError, pErrorCode);
}

function __PrintInfo(pInfo, objLogInfo) {
    reqInstanceHelper.PrintInfo(serviceName, pInfo, objLogInfo);
}

function getProcessToken(pSession, pObjLogInfo, callback) {
    try {
        var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
        reqInstanceHelper.PrintInfo(serviceName, 'Getting process token ID', pObjLogInfo);
        var processId = 0; //from audit process item table
        var params = pObjLogInfo;
        var headers = params.headers;
        if (pSession) {
            var row = {
                APP_ID: params.APP_ID,
                MODULE: params.PROCESS_INFO.MODULE,
                MENU_GROUP: params.PROCESS_INFO.MENU_GROUP,
                MENU_ITEM: params.PROCESS_INFO.MENU_ITEM,
                PROCESS_NAME: params.PROCESS_INFO.PROCESS_NAME,
                CREATED_BY: params.USER_ID,
                CREATED_DATE: reqDateFormatter.GetCurrentDate(headers)
            }; // all columns are not null constraint
            if (serviceModel && serviceModel.PLATFORM_VERSION == '7.0') {
                row.TENANT_ID = pObjLogInfo.TENANT_ID;
            }
            reqTranDBInstance.InsertTranDBWithAudit(pSession, 'PRC_TOKENS', [row], pObjLogInfo, function (result, error) {
                try {
                    if (error) {
                        reqInstanceHelper.PrintError(serviceName, pObjLogInfo, 'ERR_PRCT_0001', 'Error in getting process token ID ', error);
                        return callback(error);
                    } else {
                        processId = result[0].prct_id;
                        reqInstanceHelper.PrintInfo(serviceName, 'Process token created successfully. PRCT_ID - ' + processId, pObjLogInfo);
                        return callback(null, processId);
                    }
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, pObjLogInfo, 'ERR_PRCT_0002', 'Catch error in getting process token ID ', error);
                    return callback(error);
                }
            });
        } else {
            return callback('Error on getting db connection on getProcessToken');
        }
    } catch (error) {
        return callback(error);
    }
}

//To Send Prct Data to PRC_TOKENS_CORE
function sendPrcTokensToSolr(pHeaders, pSolrCoreName, pData, callback) {
    reqProducer = require('../../common/Producer');
    serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
    if (serviceModel && serviceModel.PLATFORM_VERSION == '7.0') {
        reqInstanceHelper.PrintInfo(serviceName, 'Platform Version - ' + serviceModel.PLATFORM_VERSION, null);
        isLatestPlatformVersion = true;
    }
    // console.log('------- pSolrCoreName -------------------> ' + pSolrCoreName);
    var strMsg = pData;
    var solrData = {
        PRCT_ID: strMsg.PRCT_ID,
        APP_ID: strMsg.APP_ID,
        TENANT_ID: strMsg.TENANT_ID,
        MODULE: strMsg.MODULE,
        MENU_GROUP: strMsg.MENU_GROUP,
        MENU_ITEM: strMsg.MENU_ITEM,
        PROCESS_NAME: strMsg.PROCESS_NAME,
        CREATED_BY: strMsg.CREATED_BY,
        CREATED_DATE: strMsg.CREATED_DATE
    };
    if (isLatestPlatformVersion) {
        reqProducer.ProduceMessage('PRC_TOKENS', solrData, pHeaders, function (res) {
            callback('SUCCESS');
        });
    } else {
        reqSolrInstance.GetSolrLogConn(pHeaders, pSolrCoreName, function (pSolrClient) {
            try {
                // console.log('<<<<<<<<<<<<<< Got solr connection >>>>>>>>>>>>>>>>>>>>');
                reqSolrInstance.SolrInsert(pSolrClient, solrData, objLogInfo, function (error, result) {
                    if (error) {
                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
                        callback('FAILURE');
                    } else {
                        callback('SUCCESS');
                    }
                });
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
                callback(error);
            }
        });
    }
}

function GetDBType(pTranDBKey, isDefaultKey, pObjLogInfo, GetDBTypeCB) {
    try {
        var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
        if (serviceModel) {
            if (serviceModel.TYPE == 'ULTIMATE') {
                reqInstanceHelper.PrintInfo(serviceName, 'ULTIMATE Environment...', pObjLogInfo);
                var tranDBKey = pTranDBKey;
                reqInstanceHelper.GetConfig(tranDBKey, function (pStrTranDBConfig, error) {
                    if (error) {
                        reqInstanceHelper.PrintInfo(serviceName, 'Error while Getting data For this Redis Key - ' + tranDBKey, pObjLogInfo);
                        reqInstanceHelper.PrintInfo(serviceName, 'Error - ' + error, pObjLogInfo);
                        GetDBTypeCB(null, error);
                    } else if (!pStrTranDBConfig) {
                        if (!isDefaultKey) {
                            reqInstanceHelper.PrintInfo(serviceName, 'There is No Data Found For this Redis Key - ' + tranDBKey, pObjLogInfo);
                            var defaultRoutingKey = 'TRANDB~CLT-0~APP-0~TNT-0~ENV-0';
                            reqInstanceHelper.PrintInfo(serviceName, 'Then Get the Config With Default Routing Key - ' + defaultRoutingKey, pObjLogInfo);
                            GetDBType(defaultRoutingKey, true, pObjLogInfo, GetDBTypeCB);
                        } else {
                            reqInstanceHelper.PrintInfo(serviceName, 'There is No Data For this Default Routing Key - ' + tranDBKey, pObjLogInfo);
                            GetDBTypeCB(null, 'There is No DB Type For this Default Routing Key - ' + tranDBKey);
                        }
                    } else {
                        var DB_Config = JSON.parse(pStrTranDBConfig);
                        if (DB_Config.DB_TYPE) {
                            reqInstanceHelper.PrintInfo(serviceName, 'DB TYPE - ' + DB_Config.DB_TYPE, pObjLogInfo);
                            GetDBTypeCB(DB_Config.DB_TYPE, null);
                        } else {
                            reqInstanceHelper.PrintInfo(serviceName, 'There is No DB Type For this Routing Key - ' + tranDBKey, pObjLogInfo);
                            GetDBTypeCB(null, 'There is No DB Type For this Routing Key - ' + tranDBKey);
                        }
                    }
                });
            } else {
                reqInstanceHelper.PrintInfo(serviceName, 'LITE Environment and DB TYPE - ' + serviceModel.TRANDB, pObjLogInfo);
                GetDBTypeCB(serviceModel.TRANDB, null);
            }
        } else {
            reqInstanceHelper.PrintInfo(serviceName, 'Error - ' + error, pObjLogInfo);
            GetDBTypeCB(null, 'Service Model Not Found....');
        }

    } catch (error) {
        reqInstanceHelper.PrintInfo(serviceName, 'Error while Getting Tran DB Config', pObjLogInfo);
        reqInstanceHelper.PrintInfo(serviceName, 'Error - ' + error, pObjLogInfo);
        GetDBTypeCB(null, error);
    }
}



module.exports = {
    GetProcessToken: getProcessToken,
    SendPrcTokensToSolr: sendPrcTokensToSolr,
    GetDBType: GetDBType,
    _AuditLog: _AuditLog
};
/********* End of File *************/