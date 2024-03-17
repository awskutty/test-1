/****
 * Api_Name          : /Upload,
 * Description       : ,
 * Last_Error_Code   : ERR-ANL-5100
 ****/

// Require dependencies
var modPath = '../../../../node_modules/';
var express = require(modPath + 'express');
var reqAnalyticInstance = require('../../../../torus-references/instance/AnalyticInstance');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');
// Initialize Global variables

var strResult = '';
var strMessage = '';

var router = express.Router();



// Host the login api
router.post('/creategroup', function (appReq, appResp) {

    reqLogInfo.AssignLogInfoDetail(appReq, function (objLogInfo, objSessionInfo) {
        reqLogWriter.Eventinsert(objLogInfo);
        objLogInfo.PROCESS = 'creategroup-Analytics';
        objLogInfo.ACTION = 'creategroup';
        var strHeader = appReq.headers;

        try {

            var params = appReq.body;
            var Group_Name = params.GROUP_NAME;
            var Program_Details = params.PROGRAM_DETAILS;
            var Project_Id = params.PROJECT_ID;
            var Depen_Prg_Id = params.PROJECT_CODE;

            var createdby = params.USER_ID;
            var createdDate = reqDateFormatter.GetCurrentDateInUTC(strHeader, objLogInfo);
            var Select_Group = "select * from program_group where group_name='" + Group_Name + "'";
            reqAnalyticInstance.GetTranDBConn(strHeader, false, function callbackGetTranDB(pSession) {
                try {
                    reqAnalyticInstance.ExecuteSQLQuery(pSession, Select_Group, objLogInfo, function callbackTransactionSetUpdate(pResult, pError) {
                        try {
                            if (pError) {
                                _SendResponse({}, 'Errcode', 'Group Not Loaded', pError, null);
                            }
                            else {
                                if (pResult.rows.length > 0) {
                                    _SendResponse('FAILURE', 'Errcode', 'Group Already Exists', '', null);
                                    return;
                                }
                                else {
                                    if (Program_Details.length > 0) {
                                        for (var i = 0; i < Program_Details.length; i++) {
                                            var project = Program_Details[i];
                                            reqAnalyticInstance.InsertTranDBWithAudit(pSession, 'PROGRAM_GROUP', [{
                                                PROJECT_ID: Project_Id,
                                                PROGRAM_ID: project["ide_project_code"],
                                                GROUP_NAME: Group_Name,
                                                CREATED_BY: createdby,
                                                CREATED_DATE: createdDate,
                                                SEQUENCE_NO: project["seq_no"]

                                            }], objLogInfo, function callbackTransactionSetUpdate(pResult, pError) {
                                                try {
                                                    if (pError) {
                                                        _SendResponse({}, 'Errcode', 'Unable To insert ', pError, null);
                                                    }
                                                    else {
                                                        //_SendResponse('SUCCESS','','',null,null );
                                                    }
                                                } catch (error) {
                                                    _SendResponse({}, 'Errcode', 'Unable To insert ', pError, null);
                                                }

                                            });
                                        }


                                    }
                                    reqAnalyticInstance.InsertTranDBWithAudit(pSession, 'PROGRAM_GROUP_DEPENDENCY', [{
                                        PROJECT_ID: Project_Id,
                                        GROUP_NAME: Group_Name,
                                        DEPENDENT_PROGRAM_ID: Depen_Prg_Id,
                                        CREATED_BY: createdby,
                                        CREATED_DATE: createdDate

                                    }], objLogInfo, function callbackTransactionSetUpdate(pResult, pError) {
                                        try {
                                            if (pError) {
                                                _SendResponse({}, 'Errcode', 'Unable To insert into Table', pError, null);
                                            }
                                            else {
                                                _SendResponse({ SUCCESS: 'Group  Created Successfully' }, '', '', '', null);
                                            }

                                        } catch (error) {
                                            _SendResponse({}, 'Errcode', 'Unable To insert into Table', error, null);
                                        }
                                    });
                                }
                            }

                        } catch (error) {
                            _SendResponse({}, 'Errcode', 'Unable To insert into Table', error, null);
                        }
                    });
                } catch (error) {
                    _SendResponse({}, 'Errcode', 'Unable To insert into Table', error, null);
                }
            });




        } catch (error) {
            _SendResponse({}, 'Errcode', 'Unable To insert into Table', error, null);
        }


        // To send the app response
        function _SendResponse(pResponseData, pErrorCode, pErrorMsg, pError, pWarning) {
            var strProcessStatus = (pWarning != null && pWarning != '') ? 'FAILURE' : 'SUCCESS';
            var ResponseData = (pResponseData == null || pResponseData == undefined) ? '' : pResponseData;
            return reqInstanceHelper.SendResponse('ChangeSearchTag', appResp, ResponseData, objLogInfo, pErrorCode, pErrorMsg, pError, strProcessStatus, pWarning);
        }


    });

});
module.exports = router;