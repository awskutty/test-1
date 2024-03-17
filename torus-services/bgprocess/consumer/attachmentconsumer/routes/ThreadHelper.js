/****
  @Descriptions                 : Get Data from hst_trn_attachments data from the Kafka topic
  @Last_Error_Code              : ERR-ATMT-CONSUMER-0008
 ****/

// Require dependencies
var reqInstanceHelper = require('../../../../../torus-references/common/InstanceHelper');
var reqSolrInstance = require('../../../../../torus-references/instance/SolrInstance');
var reqDBInstance = require('../../../../../torus-references/instance/DBInstance');
var reqTranDBInstance = require('../../../../../torus-references/instance/TranDBInstance');
var reqDateFormatter = require('../../../../../torus-references/common/dateconverter/DateFormatter');

// Global variable initialization
var serviceName = 'AttachmentConsumerThreadHelper';
var objLogInfo = null;

// Prepare json message from data row
function PrepareMessage(param, pCallback) {
    /* param should contains
        - objLogInfo
        - res_cas_instance
        - hst_trn_atmt_json */
    try {
        var objLogInfo = param.objLogInfo;
        var atmtJsonData = param.hst_trn_atmt_json;
        var columnList = ['BYTE_DATA', 'TRNAD_ID', 'RELATIVE_PATH', 'TEXT_DATA'];
        reqDBInstance.GetTableFromFXDB(param.res_cas_instance, 'TRNA_DATA', columnList, {
            relative_path: atmtJsonData.new_data_json.relative_path
        }, objLogInfo, function (TRNA_DATA_ERROR, TRNA_DATA_RESULT) {
            delete atmtJsonData.new_data_json.isFromNewAtmtConsumer;
            if (TRNA_DATA_ERROR) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-ATMT-CONSUMER-0003', 'Error in While Querying Data From TRNA_DATA Table....', TRNA_DATA_ERROR);
                pCallback(TRNA_DATA_ERROR, null);
            } else {
                reqInstanceHelper.PrintInfo(serviceName, 'Returned Rows ' + TRNA_DATA_RESULT.rows.length, objLogInfo);
                pCallback(null, TRNA_DATA_RESULT);
            }
        });

    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-ATMT-CONSUMER-0002', 'Catch Error in PrepareMessage()....', error);
        pCallback(error, null);
    }
}

function ProduceTranAtmtData(params, ProduceTranAtmtDataCB) {
    /*  params should contains
         - objLogInfo
         - hst_trn_atmt_json
         - res_cas_instance
         - tran_db_instance
         - solr_tran_atmt_instance
         - solr_fx_tran_instance
         - trna_data
         - offset
         - THREAD_INFO
         - HEADERS
         - partition
          */
    var ProduceTranAtmtDataCBResult = {
        TRAN_ATMT_CORE: { INSERT_STATUS: false, ERROR_OBJ: null, ERROR_MSG: null },
        FX_TRAN_CORE: { INSERT_STATUS: false, ERROR_OBJ: null, ERROR_MSG: null },
        TRNA_DATA_TABLE: { INSERT_STATUS: false, ERROR_OBJ: null, ERROR_MSG: null },
        TRN_ATTACHMENTS_TABLE: { INSERT_STATUS: false, ERROR_OBJ: null, ERROR_MSG: null }
    };
    try {
        var objLogInfo = params.objLogInfo || null;
        var headers = params.HEADERS || {};
        var threadInfo = params.THREAD_INFO || {};
        var trna_data = params.trna_data.rows || null;
        var fxTranCoreDate = params.hst_trn_atmt_json.new_data_json || {};
        var atmtDataInfo = {};
        if (trna_data && trna_data.length) {
            atmtDataInfo = trna_data[0];
        }
        // Preparing TRAN_ATMT Core Data
        var tranAtmtCoreData = {};
        tranAtmtCoreData.DT_CODE = fxTranCoreDate.dt_code;
        tranAtmtCoreData.DTT_CODE = fxTranCoreDate.dtt_code;
        // tranAtmtCoreData.BYTE_DATA = atmtDataInfo.byte_data;
        tranAtmtCoreData.TRNA_ID = fxTranCoreDate.trna_id;
        tranAtmtCoreData.TRN_ID = fxTranCoreDate.trn_id;
        tranAtmtCoreData.AT_CODE = fxTranCoreDate.at_code;
        tranAtmtCoreData.RELATIVE_PATH = fxTranCoreDate.relative_path;


        tranAtmtCoreData.TENANT_ID = fxTranCoreDate.tenant_id;
        tranAtmtCoreData.APP_ID = fxTranCoreDate.app_id;
        tranAtmtCoreData.ROUTINGKEY = fxTranCoreDate.routingkey;

        tranAtmtCoreData.CREATED_DATE = fxTranCoreDate.created_date;
        tranAtmtCoreData.CREATED_BY = fxTranCoreDate.created_by;
        tranAtmtCoreData.CREATED_BY_NAME = fxTranCoreDate.created_by_name;
        tranAtmtCoreData.CREATED_CLIENTIP = fxTranCoreDate.created_clientip;
        tranAtmtCoreData.CREATED_TZ = fxTranCoreDate.created_tz;
        tranAtmtCoreData.CREATED_TZ_OFFSET = fxTranCoreDate.created_tz_offset;
        tranAtmtCoreData.CREATED_BY_SESSIONID = fxTranCoreDate.created_by_sessionid;
        tranAtmtCoreData.CREATED_DATE_UTC = fxTranCoreDate.created_date_utc;

        tranAtmtCoreData.MODIFIED_DATE = fxTranCoreDate.modified_date;
        tranAtmtCoreData.MODIFIED_BY = fxTranCoreDate.modified_by;
        tranAtmtCoreData.MODIFIED_BY_NAME = fxTranCoreDate.modified_by_name;
        tranAtmtCoreData.MODIFIED_CLIENTIP = fxTranCoreDate.modified_clientip;
        tranAtmtCoreData.MODIFIED_TZ = fxTranCoreDate.modified_tz;
        tranAtmtCoreData.MODIFIED_TZ_OFFSET = fxTranCoreDate.modified_tz_offset;
        tranAtmtCoreData.MODIFIED_BY_SESSIONID = fxTranCoreDate.modified_by_sessionid;
        tranAtmtCoreData.MODIFIED_DATE_UTC = fxTranCoreDate.modified_date_utc;


        // Adding TRAN_ATMT Core Unique ID
        tranAtmtCoreData.TAC_ID = `${tranAtmtCoreData.DTT_CODE} - ${tranAtmtCoreData.TRNA_ID}`;
        console.log('TRAN_ATMT Data - ', JSON.stringify(tranAtmtCoreData, null, '\t'));

        if (atmtDataInfo.byte_data) {
            tranAtmtCoreData.TEXT_DATA = atmtDataInfo.byte_data.toString('base64');
        } else {
            tranAtmtCoreData.TEXT_DATA = atmtDataInfo.text_data;
        }
        // Preparing FX_TRAN Core Data
        fxTranCoreDate.FTC_ID = fxTranCoreDate.dtt_code + ' - ' + fxTranCoreDate.trna_id;
        fxTranCoreDate.FX_TABLE_NAME = 'trn_attachments';
        fxTranCoreDate = _objKeyToUpperCase(fxTranCoreDate);
        threadInfo.threadProcessingInfo = 'INSERT_TRAN_ATMT_SOLR_CORE_STARTED';
        reqSolrInstance.SolrInsert(params.solr_tran_atmt_instance, tranAtmtCoreData, objLogInfo, function (error, result) {
            if (error) {
                threadInfo.threadProcessingInfo = 'INSERT_TRAN_ATMT_SOLR_CORE_ERRORED';
                var errorMsg = 'Error while Inserting Data into TRAN_ATMT Core for Relative Path - ' + tranAtmtCoreData.RELATIVE_PATH;
                var errorCode = 'ERR-ATMT-CONSUMER-0004';
                reqInstanceHelper.PrintError(serviceName, objLogInfo, errorCode, errorMsg, error);
                ProduceTranAtmtDataCBResult.TRAN_ATMT_CORE.ERROR_MSG = errorMsg;
                ProduceTranAtmtDataCBResult.TRAN_ATMT_CORE.INSERT_STATUS = false;
                ProduceTranAtmtDataCBResult.TRAN_ATMT_CORE.ERROR_OBJ = error;// Gathering Error Informations
                ProduceTranAtmtDataCBResult.status = 'FAILURE';
                ProduceTranAtmtDataCB(ProduceTranAtmtDataCBResult); // Below Process will not be Executed
            } else {
                threadInfo.threadProcessingInfo = 'INSERT_TRAN_ATMT_SOLR_CORE_COMPLETED';
                ProduceTranAtmtDataCBResult.TRAN_ATMT_CORE.INSERT_STATUS = true;
                var updateCondtion = {
                    "relative_path": tranAtmtCoreData.RELATIVE_PATH
                };
                var updateObj = {
                    'IS_PROCESSED': 'Y'
                };
                threadInfo.threadProcessingInfo = 'UPDATE_TRNA_DATA_DB_STARTED';
                reqDBInstance.UpdateFXDB(params.res_cas_instance, 'TRNA_DATA', updateObj, updateCondtion, objLogInfo, function (error, result) {
                    if (error) {
                        threadInfo.threadProcessingInfo = 'UPDATE_TRNA_DATA_DB_ERRORED';
                        reqInstanceHelper.PrintInfo(serviceName, 'Error occured while update is_process in TRNA_DATA TABLE' + error, objLogInfo);
                        var errorMsg = 'Error while Inserting Data into TRNA_DATA Table for Relative Path - ' + tranAtmtCoreData.RELATIVE_PATH;
                        var errorCode = 'ERR-ATMT-CONSUMER-0005';
                        reqInstanceHelper.PrintError(serviceName, objLogInfo, errorCode, errorMsg, error);
                        ProduceTranAtmtDataCBResult.TRNA_DATA_TABLE.INSERT_STATUS = false;
                        ProduceTranAtmtDataCBResult.TRNA_DATA_TABLE.ERROR_MSG = errorMsg;
                        ProduceTranAtmtDataCBResult.TRNA_DATA_TABLE.ERROR_OBJ = error;// Gathering Error Informations
                    } else {
                        threadInfo.threadProcessingInfo = 'UPDATE_TRNA_DATA_DB_COMPLETED';
                        ProduceTranAtmtDataCBResult.TRNA_DATA_TABLE.INSERT_STATUS = true;
                    }
                    threadInfo.threadProcessingInfo = 'UPDATE_TRN_ATTACHMENTS_DB_STARTED';
                    reqTranDBInstance.UpdateTranDBWithAudit(params.tran_db_instance, 'TRN_ATTACHMENTS', updateObj, updateCondtion, objLogInfo, function (result, error) {
                        if (error) {
                            threadInfo.threadProcessingInfo = 'UPDATE_TRN_ATTACHMENTS_DB_ERRORED';
                            reqInstanceHelper.PrintInfo(serviceName, 'Error occured while update is_process in TRN_ATTACHMENTS TABLE' + error, objLogInfo);
                            var errorMsg = 'Error while Inserting Data into TRN_ATTACHMENTS Table for Relative Path - ' + tranAtmtCoreData.RELATIVE_PATH;
                            var errorCode = 'ERR-ATMT-CONSUMER-0006';
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, errorCode, errorMsg, error);
                            ProduceTranAtmtDataCBResult.TRN_ATTACHMENTS_TABLE.ERROR_MSG = errorMsg;
                            ProduceTranAtmtDataCBResult.TRN_ATTACHMENTS_TABLE.INSERT_STATUS = false;
                            ProduceTranAtmtDataCBResult.TRN_ATTACHMENTS_TABLE.ERROR_OBJ = error;// Gathering Error Informations
                        } else {
                            threadInfo.threadProcessingInfo = 'UPDATE_TRN_ATTACHMENTS_DB_COMPLETED';
                            ProduceTranAtmtDataCBResult.TRN_ATTACHMENTS_TABLE.INSERT_STATUS = true;
                        }
                        reqInstanceHelper.PrintInfo(serviceName, 'IS_PROCESSED status updated successfully in TRN_ATTACHMENTS', objLogInfo);
                        console.log('FX_TRAN Data - ', JSON.stringify(fxTranCoreDate, null, '\t'));
                        threadInfo.threadProcessingInfo = 'INSERT_FX_TRAN_SOLR_CORE_STARTED';
                        reqSolrInstance.SolrInsert(params.solr_fx_tran_instance, fxTranCoreDate, objLogInfo, function (error, result) {
                            if (error) {
                                threadInfo.threadProcessingInfo = 'INSERT_FX_TRAN_SOLR_CORE_ERRORED';
                                var errorMsg = 'Error while Inserting Data into FX_TRAN Core for Relative Path - ' + tranAtmtCoreData.RELATIVE_PATH;
                                var errorCode = 'ERR-ATMT-CONSUMER-0007';
                                reqInstanceHelper.PrintError(serviceName, objLogInfo, errorCode, errorMsg, error);
                                ProduceTranAtmtDataCBResult.FX_TRAN_CORE.ERROR_MSG = errorMsg;
                                ProduceTranAtmtDataCBResult.FX_TRAN_CORE.INSERT_STATUS = false;
                                ProduceTranAtmtDataCBResult.FX_TRAN_CORE.ERROR_OBJ = error;// Gathering Error Informations
                                ProduceTranAtmtDataCBResult.status = 'FAILURE';
                            } else {
                                threadInfo.threadProcessingInfo = 'INSERT_FX_TRAN_SOLR_CORE_COMPLETED';
                                ProduceTranAtmtDataCBResult.FX_TRAN_CORE.INSERT_STATUS = true;
                                ProduceTranAtmtDataCBResult.status = 'SUCCESS';
                                ProduceTranAtmtDataCBResult.strInfo = 'Successfully Inserted Data into Solr...';
                            }
                            ProduceTranAtmtDataCB(ProduceTranAtmtDataCBResult);
                        });
                    });
                })

            }
        });

    } catch (error) {
        var errorMsg = 'Catch Error in ProduceTranAtmtData()';
        var errorCode = 'ERR-ATMT-CONSUMER-0008';
        reqInstanceHelper.PrintError(serviceName, objLogInfo, errorCode, errorMsg, error);
        ProduceTranAtmtDataCBResult.status = 'FAILURE';
        ProduceTranAtmtDataCBResult.errorMsg = errorMsg;
        ProduceTranAtmtDataCBResult.errorObj = error;
        ProduceTranAtmtDataCB(ProduceTranAtmtDataCBResult);
    }

}

function _objKeyToUpperCase(pObj, pHeader) {
    try {
        var objForReturn = new Object();
        for (var key in pObj) {
            var strUpperCaseKey = key.toUpperCase();
            objForReturn[strUpperCaseKey] = pObj[key];
        }
        return objForReturn;
    } catch (error) {
        _TraceError(error, pHeader, 'ERR-AUDITDATA-PRODUCER-0020', 'Catch Error in _objKeyToUpperCase()...');
    }
}



// To print error messages
function _TraceError(pErrorObj, pHeader, pErrorCode, pErrInfoMesg) {
    try {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, pErrorCode, pErrInfoMesg, pErrorObj);
    } catch (e) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-AUDITDATA-PRODUCER-0002', 'Catch Error in _TraceError();...', e);
    }
}

// To print log info messages
function _TraceInfo(pMsg) {
    reqInstanceHelper.PrintInfo(serviceName, pMsg, objLogInfo);
}



module.exports = {
    PrepareMessage: PrepareMessage,
    ProduceTranAtmtData: ProduceTranAtmtData
}
/******** End of File **********/