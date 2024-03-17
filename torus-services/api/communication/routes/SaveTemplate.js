/****
  @Descriptions                 : Adding New Template Information  
  @Last_Error_Code              : ERR-SAVETEMPLATE-0005
 ****/


var reqExpress = require('express');
var reqAsync = require('async');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var router = reqExpress.Router();
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqAuditLog = require('../../../../torus-references/log/audit/AuditLog');
var reqTranDBHelper = require('../../../../torus-references/instance/TranDBInstance');
var reqDateFormater = require('../../../../torus-references/common/dateconverter/DateFormatter');

var serviceName = 'SaveTemplate';

router.post('/SaveTemplate', function (appRequest, appResponse) {
    try {
        var pHeader = appRequest.headers;
        var clientParams = appRequest.body.PARAMS;
        var commInfoInsertRows = [];
        var commTemplateList = clientParams.UPDATED_TEMPLATE_INFO || [];
        var isNewRecord = clientParams.IS_NEW_RECORD || false;
        reqLogInfo.AssignLogInfoDetail(appRequest, function (pLogInfo, pSessionInfo) {
            // var pLogInfo='';
            var objLogInfo = pLogInfo;
            objLogInfo.PROCESS_INFO.PROCESS_NAME = 'Save_Template';
            reqTranDBHelper.GetTranDBConn(pHeader, false, function (tran_db_instance) {
                reqAuditLog.GetProcessToken(tran_db_instance, objLogInfo, function (error, prct_id) {
                    for (var a = 0; a < commTemplateList.length; a++) {
                        var commTemplateObj = commTemplateList[a];
                        var commInfoInsertObj = {};
                        commInfoInsertObj.APP_ID = commTemplateObj.APP_ID || '';
                        commInfoInsertObj.EVENT_CODE = commTemplateObj.EVENT_CODE || '';
                        commInfoInsertObj.WFTPA_ID = commTemplateObj.WFTPA_ID || '';
                        commInfoInsertObj.DT_CODE = commTemplateObj.DT_CODE || '';
                        commInfoInsertObj.DTT_CODE = commTemplateObj.DTT_CODE || '';
                        commInfoInsertObj.COMMMT_CODE = commTemplateObj.COMMMT_CODE || '';
                        commInfoInsertObj.COMM_TYPE = commTemplateObj.COMM_TYPE || '';
                        commInfoInsertObj.COMMC_CODE = commTemplateObj.COMMC_CODE || '';
                        commInfoInsertObj.COMMMG_CODE = commTemplateObj.COMMMG_CODE || '';
                        commInfoInsertObj.SYSTEM_TYPE = commTemplateObj.SYSTEM_TYPE || '';
                        commInfoInsertObj.CATEGORY_INFO = commTemplateObj.CATEGORY_INFO || '';
                        commInfoInsertObj.CONTACT_INFO = commTemplateObj.CONTACT_INFO || '';
                        commInfoInsertObj.TEMPLATE_INFO = commTemplateObj.TEMPLATE_INFO || '';
                        commInfoInsertObj.CREATION_MODE = commTemplateObj.CREATION_MODE || '';
                        commInfoInsertObj.TENANT_ID = objLogInfo.TENANT_ID || '0';
                        commInfoInsertObj.TRN_QRY = commTemplateObj.TRN_QRY || '';
                        commInfoInsertObj.TRNA_QRY = commTemplateObj.TRNA_QRY || '';
                        commInfoInsertObj.created_date = reqDateFormater.GetTenantCurrentDateTime(pHeader, objLogInfo),
                        commInfoInsertObj.created_by= pSessionInfo.U_ID;
                        commInfoInsertObj.created_by_name= objLogInfo.LOGIN_NAME;
                        commInfoInsertObj.prct_id = prct_id || '';
                        commInfoInsertObj.COMM_DESCRIPTION = commTemplateObj.COMMC_DESCRIPTION ||'';
                        commInfoInsertObj.RETRY_COUNT = commTemplateObj.RETRY_COUNT ||''

                        commInfoInsertRows.push(commInfoInsertObj);
                    }


                    reqFXDBInstance.GetFXDBConnection(pHeader, 'dep_cas', objLogInfo, function (depConnection) {
                        if (!isNewRecord) {
                            reqAsync.forEachOfSeries(commInfoInsertRows, function (commInfoInsertObj, i, commInfoInsertObjCB) {
                                DeleteTemplate(commInfoInsertObj, function (params) {
                                    commInfoInsertObjCB();
                                });
                            }, function (error, result) {
                                AddNewTemplate();
                            });
                        } else {
                            return AddNewTemplate();
                        }


                        function AddNewTemplate(params, AddNewTemplateCB) {
                            try {
                                reqFXDBInstance.InsertFXDB(depConnection, 'COMM_INFO', commInfoInsertRows, objLogInfo, function (error, result) {
                                    if (error) {
                                        reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-SAVETEMPLATE-0002', 'Error While Inserting Data into COMM_INFO Table...', error, 'FAILURE', '');
                                    } else {
                                        reqInstanceHelper.SendResponse(serviceName, appResponse, 'SUCCESS', objLogInfo, '', '', '', '', '');
                                    }
                                });
                            } catch (error) {
                                reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-SAVETEMPLATE-0005', 'Catch Error in AddNewTemplate()....', error, 'FAILURE', '');
                            }
                        }


                        function DeleteTemplate(clientParams, DeleteTemplateCB) {
                            try {
                                var delteCondObj = {
                                    APP_ID: clientParams.APP_ID,
                                    EVENT_CODE: clientParams.EVENT_CODE,
                                    WFTPA_ID: clientParams.WFTPA_ID,
                                    DT_CODE: clientParams.DT_CODE,
                                    DTT_CODE: clientParams.DTT_CODE,
                                    TENANT_ID: objLogInfo.TENANT_ID,
                                    COMMMT_CODE: clientParams.COMMMT_CODE
                                };
                                reqFXDBInstance.DeleteFXDB(depConnection, 'COMM_INFO', delteCondObj, objLogInfo, function (error, result) {
                                    if (error) {
                                        reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-SAVETEMPLATE-0003', 'Error While Deleting Data into COMM_INFO Table...', error, 'FAILURE', '');
                                    } else {
                                        DeleteTemplateCB();
                                    }
                                });
                            } catch (error) {
                                reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-SAVETEMPLATE-0004', 'Catch Error in DeleteTemplate()....', error, 'FAILURE', '');
                            }
                        }
                    });
                });
            });
        });
    } catch (error) {
        reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-SAVETEMPLATE-0001', 'Catch Error in SaveTemplate API....', error, 'FAILURE', '');
    }

});

module.exports = router;