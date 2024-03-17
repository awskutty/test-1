/****
  @Descriptions                 : Get Data from hst_trn_attachments data from the Kafka topic
  @Last_Error_Code              : ERR-ATMT-CONSUMER-0002
  @Released						:Path changes	
 ****/

// Require dependencies
var reqInstanceHelper = require('../../../../../torus-references/common/InstanceHelper');
var reqSolrInstance = require('../../../../../torus-references/instance/SolrInstance');
var reqSaveAttachmentToSolr = require('../../../../../torus-references/common/solrhelper/saveattachment/SaveAttachmentToSolr');

// Global variable initialization
var serviceName = 'CommunicationConsumerThreadHelper';
var objLogInfo = null;

// Prepare json message from data row
function PrepareMessage(param, pCallback) {
    /* param should contains
        - objLogInfo
        - Header
        - hst_trn_atmt_json */
    try {
        var objLogInfo = param.objLogInfo;
        var atmtJsonData = param.hst_trn_atmt_json;
        if (atmtJsonData && atmtJsonData.new_data_json) {
            atmtJsonData.new_data_json = JSON.parse(atmtJsonData.new_data_json);
            atmtJsonData.new_data_json.headers = param.Header;
            atmtJsonData.new_data_json.isFromNewAtmtConsumer = true;
        }
        reqInstanceHelper.PrintInfo(serviceName, 'Preparing Data for TRAN_ATMT Solr Core...', objLogInfo);
        reqSaveAttachmentToSolr.StartSaveAttachmentConsumer(atmtJsonData.new_data_json, objLogInfo, function (params) {
            delete atmtJsonData.new_data_json.isFromNewAtmtConsumer;
            pCallback(params);
        });

    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-ATMT-CONSUMER-0002', 'Catch Error in PrepareMessage()....', error);
        pCallback({});
    }
}

function ProduceTranAtmtData(params, ProduceTranAtmtDataCB) {
    /*  params should contains
         - objLogInfo
         - hst_trn_atmt_json
         - trna_data
         - headers
          */
    var ProduceTranAtmtDataCBResult = {};
    try {
        var objLogInfo = params.objLogInfo || null;
        var headers = params.headers || null;
        var trna_data = params.trna_data.rows || null;
        var fxTranCoreDate = params.hst_trn_atmt_json.new_data_json || {};
        if (fxTranCoreDate.headers) delete fxTranCoreDate.headers;
        var atmtDataInfo = {};
        if (trna_data && trna_data.length) {
            atmtDataInfo = trna_data[0];
        }
        // Preparing TRAN_ATMT Core Data
        var tranAtmtCoreData = {};
        // Adding TRAN_ATMT Core Unique ID
        // tranAtmtCoreData.TAC_ID = fxTranCoreDate.dtt_code + ' - ' + fxTranCoreDate.trna_id;
        tranAtmtCoreData.DT_CODE = fxTranCoreDate.dt_code;
        tranAtmtCoreData.DTT_CODE = fxTranCoreDate.dtt_code;
        // tranAtmtCoreData.BYTE_DATA = atmtDataInfo.byte_data;
        if (atmtDataInfo.byte_data) {
            tranAtmtCoreData.TEXT_DATA = atmtDataInfo.byte_data.toString('base64');
        } else {
            tranAtmtCoreData.TEXT_DATA = atmtDataInfo.text_data;
        }
        tranAtmtCoreData.TRNA_ID = fxTranCoreDate.trna_id;
        tranAtmtCoreData.TRN_ID = fxTranCoreDate.trn_id;
        tranAtmtCoreData.AT_CODE = fxTranCoreDate.at_code;
        tranAtmtCoreData.RELATIVE_PATH = fxTranCoreDate.relative_path;

        // Preparing FX_TRAN Core Data
        fxTranCoreDate.FTC_ID = fxTranCoreDate.dtt_code + ' - ' + fxTranCoreDate.trna_id;
        fxTranCoreDate = _objKeyToUpperCase(fxTranCoreDate);
        reqSolrInstance.GetSolrSearchConn(headers, 'TRAN_ATMT', function (tranAtmtSolrInstance) {
            console.log('TRAN_ATMT Data - ', JSON.stringify(tranAtmtCoreData, null, '\t'));
            reqSolrInstance.SolrInsert(tranAtmtSolrInstance, tranAtmtCoreData, objLogInfo, function (error, result) {
                if (error) {
                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
                    ProduceTranAtmtDataCBResult.status = 'FAILURE';
                    ProduceTranAtmtDataCBResult.strInfo = 'Error While inserting data into TRAN_ATMT Solr Core...';
                    ProduceTranAtmtDataCBResult.errorObj = error;
                    ProduceTranAtmtDataCB(ProduceTranAtmtDataCBResult);
                } else {
                    reqSolrInstance.GetSolrSearchConn(headers, 'FX_TRAN', function (fxTranSolrInstance) {
                        console.log('FX_TRAN Data - ', JSON.stringify(fxTranCoreDate, null, '\t'));
                        reqSolrInstance.SolrInsert(fxTranSolrInstance, fxTranCoreDate, objLogInfo, function (error, result) {
                            if (error) {
                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
                                ProduceTranAtmtDataCBResult.status = 'FAILURE';
                                ProduceTranAtmtDataCBResult.strInfo = 'Error While inserting data into FX_TRAN Solr Core...';
                                ProduceTranAtmtDataCBResult.errorObj = error;
                                ProduceTranAtmtDataCB(ProduceTranAtmtDataCBResult);
                            } else {
                                ProduceTranAtmtDataCBResult.status = 'SUCCESS';
                                ProduceTranAtmtDataCBResult.strInfo = 'Successfully Inserted Datat into Solr...';
                                ProduceTranAtmtDataCB(ProduceTranAtmtDataCBResult);
                            }
                        });
                    });

                    ProduceTranAtmtDataCBResult.status = 'SUCCESS';
                    ProduceTranAtmtDataCBResult.strInfo = 'Successfully Inserted Datat into Solr...';
                    ProduceTranAtmtDataCB(ProduceTranAtmtDataCBResult);
                }
            });
        });

    } catch (error) {
        ProduceTranAtmtDataCBResult.status = 'FAILURE';
        ProduceTranAtmtDataCBResult.strInfo = 'Catch Error While inserting data into FX_TRAN and TRAN_ATMT Solr Cores...';
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
    }
    catch (e) {
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
};
/******** End of File **********/