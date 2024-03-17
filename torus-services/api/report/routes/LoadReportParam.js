/*
@Api_Name         : /LoadReportParam
@Description      : To LoadReportParam
@Last_Error_code  : ERR-RPT-60106
*/

// Require dependencies
var modPath = '../../../../node_modules/'
var refPath = '../../../../torus-references/'
var reqExpress = require(modPath + 'express')
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var router = reqExpress.Router();
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqInsHelper = require('../../../../torus-references/common/InstanceHelper');


// Host the api
router.post('/LoadReportParam', function (appRequest, appResponse) {

    // variable declaration
    var strArptId = ''
    var strAppId = ''
    var strInputParam = appRequest.body.PARAMS;
    var strReqHeader = appRequest.headers;
    var objLogInfo;
    var mDepCas;

    reqLogInfo.AssignLogInfoDetail(appRequest, function (pLogInfo, pSessionInfo) {

        objLogInfo = pLogInfo
        objLogInfo.HANDLER_CODE = 'LoadReportParam';

        _PrintInfo('Begin')

        appResponse.on('close', function () { });
        appResponse.on('finish', function () { });
        appResponse.on('end', function () { });

        try {
            _PrintInfo('Calling _InitializeDB function');
            _InitializeDB(strReqHeader, function callbackInitializeDB(pStatus) {

                // Initialize params
                _PrintInfo('Calling _InitializeParams function');
                _InitializeParams(strInputParam, pSessionInfo, function callbackInitializeParam(pInputStatus) {
                    if (pInputStatus.Status == 'SUCCESS') {
                        _GetReportDefinitionsParam(function callback(pResult) {
                            var strResult = pResult.Data
                            _SendResponse(strResult, pResult.ErrorCode, pResult.ErrorMsg, pResult.Error, pResult.Warning)
                        });
                    } else
                        _SendResponse(null, pInputStatus.ErrorCode, pInputStatus.ErrorMsg, pInputStatus.Error, pInputStatus.Warning)
                })
            })
        } catch (error) {
            _SendResponse(null, 'ERR-RPT-60101', 'Error in LoadReportParam table', error, null)
        }

        // To get the report definition params
        function _GetReportDefinitionsParam(pCallback) {
            try {
                // get Rpt definitions info table
                _PrintInfo('Querying APP_RPT_DEFINITIONS_INFO table');
                reqFXDBInstance.GetTableFromFXDB(mDepCas, 'APP_RPT_DEFINITIONS_INFO', ['ARPTD_ID', 'RPT_PARAM_UI_CONTROLLER', 'RPT_PARAM_UI_VIEW', 'RPT_PARAM_JSON'], {
                    APP_ID: strAppId,
                    ARPTD_ID: strArptId
                }, objLogInfo, function callbackGetTableFromFXDB(pError, pResult) {
                    var objRptResult = {}
                    if (pError) {
                        return _PrepareAndSendCallback('FAILURE', null, 'ERR-RPT-60102', 'Error while Querying APP_RPT_DEFINITIONS_INFO table', pError, null, pCallback)
                    } else if (pResult) {
                        _PrintInfo('Got Result from APP_RPT_DEFINITIONS_INFO table');
                        try {
                            for (var i = 0; i < pResult.rows.length; i++) {
                                var dr = pResult.rows[i]
                                var UI_Controller = dr['rpt_param_ui_controller']
                                var UI_View = dr['rpt_param_ui_view']
                                objRptResult.RPT_SCRIPT = "<script>" + UI_Controller + ' ' + UI_View + "</script>"

                                // Pad left 4 digit for arptd_id
                                var str = "" + dr['arptd_id'].toString()
                                var pad = "0000"
                                var strArptId = pad.substring(0, pad.length - str.length) + str
                                var arptid = "rptd" + strArptId
                                objRptResult.DIRECTIVE_NAME = "<" + arptid + "></" + arptid + ">"
                                objRptResult.CONTROLLER_NAME = "con" + arptid
                                 if (dr['rpt_param_json'] != '') {
                                    objRptResult.PARAM_JSON = _objKeyToLowerCase(JSON.parse(dr['rpt_param_json']))
                                } else {
                                    objRptResult.PARAM_JSON = []
                                }
                            }
                            return _PrepareAndSendCallback('SUCCESS', objRptResult, '', '', null, null, pCallback)
                        } catch (error) {
                            return _PrepareAndSendCallback('FAILURE', null, 'ERR-RPT-60103', 'Error on _GetReportDefinitionsParam()', error, null, pCallback)
                        }
                    }
                })
            } catch (error) {
                return _PrepareAndSendCallback('FAILURE', null, 'ERR-RPT-60104', 'Error on _GetReportDefinitionsParam()', error, null, pCallback)
            }
        }

        // Convert object keys to lowercase
        function _objKeyToLowerCase(pArrObj) {
            var arrObject = []
            for (var i = 0; i < pArrObj.length; i++) {
                var pObj = {};
                for (var key in pArrObj[i]) {
                    var value = ''
                    var strLowerCaseKey = key.toLowerCase();
                    if ((pArrObj[i]['UICTRL_CODE'] == 'CBO'  || pArrObj[i]['UICTRL_CODE'] == 'MULTI_SELECT_CBO'|| pArrObj[i]['UICTRL_CODE'] == 'EDIT_CBO') && key.toLowerCase() == 'rpt_ds_info')
                        value = __GenerateComboDataSource(pArrObj[i]['DATA_SOURCE'], JSON.parse(pArrObj[i][key]))
                    else
                        value = pArrObj[i][key];

                    pObj[strLowerCaseKey] = value;
                }
                arrObject.push(pObj)
            }
            return arrObject;
        }

        function __GenerateComboDataSource(pDsCode, pDSObject) {
            var DsRows = [];
            if (pDSObject.TYPE == "DPS_STATIC") {
                var FirstRecodDisplay = pDSObject.FIRST_RECORD_DISPLAY;
                var DisplayMember = pDSObject.DISPLAY_MEMBER;
                var ValueMember = pDSObject.VALUE_MEMBER;
                var InitialObject = {};
                if (FirstRecodDisplay != undefined && FirstRecodDisplay != "") {
                    InitialObject[DisplayMember] = FirstRecodDisplay;
                    InitialObject[ValueMember] = "";
                }
                if (Object.keys(InitialObject).length > 0) {
                    DsRows.push(InitialObject);
                }
                for (var dsr = 0; dsr < pDSObject.ROWS.length; dsr++) {
                    var dsrowvalues = pDSObject.ROWS[dsr].VALUES.split(";");
                    if (dsrowvalues && dsrowvalues.length > 1) {
                        var DsObjectValues = {};
                        DsObjectValues[DisplayMember] = dsrowvalues[1];
                        DsObjectValues[ValueMember] = dsrowvalues[0];
                        DsRows.push(DsObjectValues);
                    }
                }
            } else if (pDSObject.TYPE == "SUB_DETAILS") {
                DsRows = pDSObject.DETAILS;
            } else {
                DsRows = pDSObject.ROWS;
            }

            // prepare datasource
            var ControlDataSource = {
                ds_code: pDsCode,
                ds_description: pDsCode,
                type: pDSObject.TYPE,
                value_member: pDSObject.VALUE_MEMBER || "",
                display_member: pDSObject.DISPLAY_MEMBER || "",
                first_record_display: pDSObject.FIRST_RECORD_DISPLAY || "",
                need_first_time_selection: pDSObject.NEED_FIRST_ITEM_SELECTION || "",
                need_auto_first_record: pDSObject.NEED_AUTO_FIRST_RECORD || "",
                column_list: pDSObject.COLUMN_LIST || "",
                order_by: pDSObject.ORDER_BY || "",
                filters: pDSObject.FILTERS || [],
                type_desc: pDSObject.TYPE_DESC,
                rows: DsRows || [],
                target_table: pDSObject.TARGET_TABLE || "",
                context: pDSObject.CONTEXT || ""
            };
            //for combo type BIND_SYSTEMS and BIND_USERS
            if (pDSObject.TYPE == 'BIND_SYSTEMS' || pDSObject.TYPE == 'BIND_USERS') {
                ControlDataSource.current_sys = pDSObject.CURRENT_SYS || "NONE";
                ControlDataSource.childsys = pDSObject.CHILDSYS
                ControlDataSource.parentsys = pDSObject.PARENT_SYS || 'NONE'
            }

            return ControlDataSource;
        }

        // Initialize the DB
        function _InitializeDB(pHeaders, pCallback) {
            try {
                reqFXDBInstance.GetFXDBConnection(pHeaders, 'dep_cas', objLogInfo, function CallbackGetCassandraConn(pClient) {
                    _PrintInfo('Cassandra Connection Initiated Successfully');
                    mDepCas = pClient
                    pCallback('Success')
                })
            } catch (error) {
                return _PrepareAndSendCallback('FAILURE', null, 'ERR-RPT-60106', 'Exception occured', error, null, pCallback)
            }
        }

        // Initializing the params
        function _InitializeParams(pClientParam, pSessionInfo, pCallback) {
            try {
                // Prepare session level param
                if (pSessionInfo['APP_ID'] != undefined && pSessionInfo['APP_ID'] != '')
                    strAppId = pSessionInfo['APP_ID'].toString()

                // Prepare client params
                if (pClientParam['ARPTD_ID'] != undefined && pClientParam['ARPTD_ID'] != '')
                    strArptId = pClientParam['ARPTD_ID'].toString()

                _PrepareAndSendCallback('SUCCESS', null, '', '', null, null, pCallback)

            } catch (error) {
                _PrepareAndSendCallback('FAILURE', null, 'ERR-RPT-60105', 'Error on _InitializeParams()', error, null, pCallback)
            }
        }


    })

    // To print the Error
    function _PrintError(pErrCode, pMessage, pError) {
        reqInsHelper.PrintError('LoadReportParam', objLogInfo, pErrCode, pMessage, pError)
    }

    // To print the information 
    function _PrintInfo(pMessage) {
        reqInsHelper.PrintInfo('LoadReportParam', pMessage, objLogInfo)
    }

    // To prepare and send callback object
    function _PrepareAndSendCallback(pStatus, pData, pErrorCode, pErrMsg, pError, pWarning, pCallback) {
        var objCallback = {
            Status: pStatus,
            Data: pData,
            ErrorCode: pErrorCode,
            ErrorMsg: pErrMsg,
            Error: pError,
            Warning: pWarning
        }
        return pCallback(objCallback)
    }

    // To prepare the callback object
    function _PrepareCallbackObject(pStatus, pData, pErrorCode, pErrMsg, pError, pWarning) {
        var objCallback = {
            Status: pStatus,
            Data: pData,
            ErrorCode: pErrorCode,
            ErrorMsg: pErrMsg,
            Error: pError,
            Warning: pWarning
        }
        return objCallback
    }

    // To send the app response
    function _SendResponse(pResponseData, pErrorCode, pErrorMsg, pError, pWarning) {
        var strProcessStatus = (pWarning != null && pWarning != '') ? 'FAILURE' : 'SUCCESS'
        var ResponseData = (pResponseData == null || pResponseData == undefined) ? '' : pResponseData
        return reqInsHelper.SendResponse('LoadReportParam', appResponse, ResponseData, objLogInfo, pErrorCode, pErrorMsg, pError, strProcessStatus, pWarning)
    }
})

module.exports = router
/*********** End of Service **********/