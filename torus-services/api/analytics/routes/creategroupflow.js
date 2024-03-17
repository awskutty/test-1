/****
 * Api_Name          : /Upload,
 * Description       : ,
 * Last_Error_Code   : ERR-ANL-5100
 ****/

// Require dependencies
var modPath = '../../../../node_modules/'
var express = require(modPath + 'express');
var reqAnalyticInstance = require('../../../../torus-references/instance/AnalyticInstance');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper')
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter')
// Initialize Global variables

var strResult = '';
var strMessage = '';

var router = express.Router();



// Host the login api
router.post('/creategroupflow', function (appReq, appResp) {

    reqLogInfo.AssignLogInfoDetail(appReq, function (objLogInfo, objSessionInfo) {
        reqLogWriter.Eventinsert(objLogInfo);
        objLogInfo.PROCESS = 'creategroupflow-Analytics';
        objLogInfo.ACTION = 'creategroupflow';
        var strHeader = appReq.headers;

        try {

            var params = appReq.body;
            var Group_Flow_Name = params.GROUP_FLOW_NAME
            var Group_Details = params.GROUP_DETAILS
            var Project_Id = params.PROJECT_ID;
            var Depen_Grp_Name = params.DEPENDENT_GROUP_NAME;
            var response = {};
            var createdby = params.USER_ID
            var createdDate = reqDateFormatter.GetCurrentDateInUTC(strReqHeader, objLogInfo) 
            var Select_Group = "select * from program_group_flow where flow_name='" + Group_Flow_Name + "'";
            reqAnalyticInstance.GetTranDBConn(strHeader, false, function callbackGetTranDB(pSession) {
                try {
                    reqAnalyticInstance.ExecuteSQLQuery(pSession, Select_Group, objLogInfo, function callbackTransactionSetUpdate(pResult, pError) {
                        try {
                            if (pError) {
                                _SendResponse({}, 'Errcode', 'Group Flow Not Loaded', pError, null);
                            }
                            else {
                                if (pResult.rows.length > 0) {
                                    _SendResponse('FAILURE', 'Errcode', 'Group Flow Already Exists', '', null);
                                    return;
                                }
                                else {
                                    if (Group_Details.length > 0) {
                                        for (var i = 0; i < Group_Details.length; i++) {
                                            var project = Group_Details[i];
                                            reqAnalyticInstance.InsertTranDBWithAudit(pSession, 'PROGRAM_GROUP_FLOW', [{
                                                PROJECT_ID: Project_Id,
                                                GROUP_NAME: project["group_name"],
                                                FLOW_NAME: Group_Flow_Name,
                                                SEQUENCE_NO: project["seq_no"],
                                                CREATED_BY: createdby,
                                                CREATED_DATE: createdDate

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

                                            })
                                        }
                                    }
                                    reqAnalyticInstance.InsertTranDBWithAudit(pSession, 'PROGRAM_GROUP_FLOW_DEPENDENCY', [{
                                        PROJECT_ID: Project_Id,
                                        PG_FLOW_NAME: Group_Flow_Name,
                                        DEPENDENT_PROGRAM_GROUP_NAME: Depen_Grp_Name,
                                        CREATED_BY: createdby,
                                        CREATED_DATE: createdDate

                                    }], objLogInfo, function callbackTransactionSetUpdate(pResult, pError) {
                                        try {
                                            if (pError) {
                                                _SendResponse({}, 'Errcode', 'Unable To insert into Table', pError, null);
                                            }
                                            else
                                                _SendResponse({SUCCESS:'Group Flow Created Successfully'}, '', '','',null);
                                        } catch (error) {
                                            _SendResponse({}, 'Errcode', 'Unable To insert into Table', error, null);
                                        }
                                    })
                                }
                            }

                        } catch (error) {
                            _SendResponse({}, 'Errcode', 'Unable To insert into Table', error, null);
                        }
                    })
                } catch (error) {
                    _SendResponse({}, 'Errcode', 'Unable To insert into Table', error, null);
                }
            })




        } catch (error) {
            _SendResponse({}, 'Errcode', 'Unable To insert into Table', error, null);
        }

       
        // To send the app response
        function _SendResponse(pResponseData, pErrorCode, pErrorMsg, pError, pWarning) {
            var strProcessStatus = (pWarning != null && pWarning != '') ? 'FAILURE' : 'SUCCESS'
            var ResponseData = (pResponseData == null || pResponseData == undefined) ? '' : pResponseData
            return reqInstanceHelper.SendResponse('ChangeSearchTag', appResp, ResponseData, objLogInfo, pErrorCode, pErrorMsg, pError, strProcessStatus, pWarning)
        }


    })

});
module.exports = router;