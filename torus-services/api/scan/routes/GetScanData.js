/*
@Api_Name : /GetScanData
@Description : Get the Scandate
@Error_Code : ERR-SCN-80133
*/
// Require dependencies
var async = require("async");
var modPath = '../../../../node_modules/';
var reqExpress = require(modPath + 'express');
var router = reqExpress.Router();
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqsvchelper = require('../../../../torus-references/common/serviceHelper/ServiceHelper');
var strServiceName = 'GetScanData';


// Cassandra initialization
//Global variable initialization
var mClient;
var cltcasClient;
var stsResult = '';
//Host api to server
router.post('/GetScanData', function (appRequest, appResponse) {
    reqLogInfo.AssignLogInfoDetail(appRequest, function callbackAssignLogInfoDetail(pLogInfo, pSessionInfo) {
        try {
            var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
            var objLogInfo = pLogInfo;
            _PrintInfo(objLogInfo, 'GetScanData Begin');
            var hashresult = '';
            var UICGCC_ID = 0;
            var WFTPAID = '';
            var DT_CODE = '';
            var DTT_CODE = '';
            var VWFTPA_ID = '';
            var STPC_ID = '';
            var COMMENT = '';
            var NEED_COMMENT = '';
            var TOKEN_ID = '';
            var pAppId = '';
            var TENANT_ID = '';
            var CLIENT_ID = '';
            var APP_CODE = '';
            var APP_DESCRIPTION = '';
            var APPU_ID = '';
            var IS_DEFAULT = '';
            var UID = '';
            var STS_ID = '';
            var APPR_ID = '';
            var at_code = '';
            var scs_code = '';
            var RS_CODE = '';
            var dttak_short_code = '';

            var dtparamresult = '';
            var apphandlerresult = '';
            var DATA_TEMPLATE_DT_TYPESresult = '';
            var ENTITY_KEY_COLUMNSresult = '';
            var wftparesult = '';
            var attachtyperesult = '';
            var scanresult = '';
            var dtattachmentresult = '';
            var apiresult = '';
            // objLogInfo.USER_NAME = pSessionInfo.LOGIN_NAME;
            appResponse.setHeader('Content-Type', 'application/json');
            var strOrm = 'knex';
            var pResult = '';
            var result = '';
            var strInputParamJson = '';
            strInputParamJson = appRequest.body;
            getparamvalues(strInputParamJson);
            var strReqHeader = appRequest.headers;
            reqDBInstance.GetFXDBConnection(strReqHeader, 'dep_cas', objLogInfo, function Callback_GetCassandraConn(pClient) {
                mClient = pClient;
                reqDBInstance.GetFXDBConnection(strReqHeader, 'clt_cas', objLogInfo, function CallbackGetCassandraConn(pCltClient) {
                    cltcasClient = pCltClient;
                    GetScanData(function (callbackresult) {
                        var result = callbackresult;
                        reqLogWriter.EventUpdate(objLogInfo);
                        appResponse.send(result);
                    });

                });
            });

            function getparamvalues(strInputParamJson) {
                try {
                    UICGCC_ID = '';
                    WFTPAID = 'FX_EMP_TEMP_A_Code_1_17';
                    DT_CODE = strInputParamJson.DT_CODE;
                    DTT_CODE = strInputParamJson.DTT_CODE;
                    // DTT_CODE = 'DTT_FX_SCAN_CITIZEN';
                    VWFTPA_ID = '';
                    STPC_ID = '';
                    COMMENT = '';
                    NEED_COMMENT = '';
                    TOKEN_ID = '';
                    APP_ID = strInputParamJson.APP_ID;
                    TENANT_ID = strInputParamJson.TENANT_ID;
                    CLIENT_ID = strInputParamJson.CLIENT_ID;
                    APP_CODE = '';
                    APP_DESCRIPTION = '';
                    APPU_ID = '';
                    IS_DEFAULT = '';
                    UID = '';
                    STS_ID = '';
                    APPR_ID = '';
                    at_code = 'IMG';
                    scs_code = '';
                    RS_CODE = '';
                    dttak_short_code = '';
                    at_id = '70000';
                } catch (error) {
                    _PrintError(objLogInfo, "ERR-SCN-80214", "Catch Error in getparamvalues function" + error);
                }

            }

            function GetScanData(callbackmain) {

                try {
                    var arrHash = [];
                    async.parallel([
                        // GETDTPARAMS table - table1
                        function (callback) {
                            try {
                                var pResult = "";
                                var arr = [];
                                var strAppID = APP_ID;
                                var strdtcode = DT_CODE;
                                var cond = new Object();
                                cond.app_id = APP_ID;
                                cond.dt_code = DT_CODE;

                                reqDBInstance.GetTableFromFXDB(mClient, 'DT_INFO', ['param_json'], cond, objLogInfo, function (pErr, pResult) {

                                    var objparamINFO = {};
                                    if (pResult.rows.length == 0) {
                                        _PrintError(objLogInfo, "ERR-SCN-80101", "No DT_Params Info found");
                                    } else {
                                        try {
                                            objparamINFO = JSON.parse(pResult.rows[0].param_json);
                                            for (var i = 0; i < objparamINFO.length; i++) {
                                                var DTParams = {};
                                                DTParams.WFTPA_ID = 0;
                                                DTParams.dt_cODE = strdtcode;
                                                DTParams.DTP_PARAM_NAME = objparamINFO[i].PARAM_NAME;
                                                DTParams.DTP_CATEGORY = objparamINFO[i].CATEGORY;
                                                DTParams.DTP_PARAM_VALUE = objparamINFO[i].PARAM_VALUE;
                                                arr.push(DTParams);
                                            }
                                        } catch (error) {
                                            _PrintError(objLogInfo, "ERR-SCN-80102", "Error in DTParams" + error);
                                        }
                                    }
                                    dtparamresult = JSON.stringify(arr);
                                    callback();
                                });
                            } catch (error) {
                                _PrintError(objLogInfo, "ERR-SCN-80103", "Error in GETDTPARAMS table" + error);
                            }
                        },
                        // // App_Handlers table - table
                        function (callback) {
                            try {
                                var cond = new Object();
                                cond.ah_category = ['SCANNER', 'CATEGORIZATION', 'GROUPING'];
                                reqDBInstance.GetTableFromFXDB(mClient, 'APP_HANDLERS', ['ah_code', 'assembly_full_name', 'ah_category'], cond, objLogInfo, function (err, Result) {
                                    if (err)
                                        _PrintError(objLogInfo, "ERR-SCN-80104", err);
                                    else {
                                        if (Result.rows.length == 0) {
                                            _PrintError(objLogInfo, "ERR-SCN-80105", "No APP Handlers Info found");
                                        } else {
                                            var arrapphanler = [];
                                            try {
                                                for (var i = 0; i < Result.rows.length; i++) {
                                                    var objapphanler = {};
                                                    objapphanler.ah_code = Result.rows[i].ah_code;
                                                    objapphanler.assembly_full_name = Result.rows[i].assembly_full_name;
                                                    objapphanler.ah_category = Result.rows[i].ah_category;
                                                    arrapphanler.push(objapphanler);
                                                }
                                            } catch (error) {
                                                _PrintError(objLogInfo, "ERR-SCN-80106", "Error in objapphanler" + error);
                                            }
                                        }
                                        apphandlerresult = JSON.stringify(arrapphanler);
                                        callback();
                                    }
                                });
                            } catch (error) {
                                _PrintError(objLogInfo, "ERR-SCN-80107", "Error in App_Handlers table" + error);
                            }
                        },
                        //tenant setup for ocr

                        function (callback) {
                            var api_value = '';
                            var jsonparseresult;
                            try {

                                if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
                                    var cond = {};
                                    cond.setup_code = 'OCR_API';
                                    reqsvchelper.GetSetupJson(pClient, cond, objLogInfo, function (res) {
                                        if (res.Status == 'SUCCESS' && res.Data.length) {
                                            api_value = res.Data[0].setup_json;
                                            jsonparseresult = JSON.parse(api_value);
                                            apiresult = jsonparseresult.OCR_API;
                                            console.log('ocr api');
                                            console.log(apiresult);
                                            callback();
                                        } else {
                                            return reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, res.ErrorCode, res.ErrorMsg, res.Error);
                                        }
                                    });
                                } else {
                                    var tenant_id = TENANT_ID;
                                    var category = 'OCR_API';
                                    var condtnt = new Object();
                                    condtnt.tenant_id = TENANT_ID;
                                    condtnt.client_id = CLIENT_ID;
                                    condtnt.category = 'OCR_API';
                                    reqDBInstance.GetTableFromFXDB(cltcasClient, 'TENANT_SETUP', ['setup_json'], condtnt, objLogInfo, function (err, Result) {
                                        if (err)
                                            _PrintError(objLogInfo, "ERR-SCN-80108", err);
                                        else {
                                            if (Result.rows.length == 0) {
                                                try {
                                                    var client_id = CLIENT_ID;
                                                    var category = 'OCR_API';
                                                    var condct = new Object();
                                                    condct.client_id = CLIENT_ID;
                                                    condct.category = 'OCR_API';
                                                    reqDBInstance.GetTableFromFXDB(cltcasClient, 'CLIENT_SETUP', ['setup_json'], condct, objLogInfo, function (err, Result) {
                                                        if (err)
                                                            _PrintError(objLogInfo, "ERR-SCN-80109", err);
                                                        else {
                                                            if (Result.rows.length == 0) {
                                                                _PrintError(objLogInfo, "ERR-SCN-80110", "No client_setup Info found");
                                                            } else {
                                                                try {
                                                                    for (var i = 0; i < Result.rows.length; i++) {
                                                                        api_value = Result.rows[i].setup_json;
                                                                    }
                                                                    jsonparseresult = JSON.parse(api_value);
                                                                    apiresult = jsonparseresult.OCR_API;
                                                                    console.log('ocr api');
                                                                    console.log(apiresult);
                                                                    callback();
                                                                } catch (error) {
                                                                    apiresult = '';
                                                                    callback();
                                                                    //_PrintError("ERR-SCN-80111", "Error in objapphanler" + error)
                                                                }
                                                            }
                                                        }
                                                    });
                                                } catch (error) {
                                                    apiresult = '';
                                                    callback();
                                                    //_PrintError("ERR-SCN-80112", "Error in App_Handlers table" + error)
                                                }

                                            } else {
                                                try {
                                                    for (var i = 0; i < Result.rows.length; i++) {
                                                        api_value = Result.rows[i].setup_json;
                                                    }
                                                    jsonparseresult = JSON.parse(api_value);
                                                    apiresult = jsonparseresult.OCR_API;
                                                    console.log('ocr api');
                                                    console.log(apiresult);
                                                    callback();
                                                } catch (error) {
                                                    apiresult = '';
                                                    callback();
                                                    // _PrintError("ERR-SCN-80113", "Error in objapphanler" + error)
                                                }
                                            }

                                        }
                                    });

                                }
                            } catch (error) {
                                apiresult = '';
                                callback();
                                //_PrintError("ERR-SCN-80114", "Error in App_Handlers table" + error)
                            }
                        },


                        // Attachment Types table - table 
                        function (callback) {
                            try {
                                var stratcode = at_code;
                                var arrattachmenttypes = [];
                                reqDBInstance.GetTableFromFXDB(mClient, 'ATTACHMENT_TYPES', ['at_code', 'at_extensions', 'at_description', 'at_id', 'watermark_code'], {
                                    'at_code': stratcode
                                }, objLogInfo, function (err, pResult) {

                                    if (err)
                                        _PrintError(objLogInfo, "ERR-SCN-80115", err);
                                    else {
                                        var strParams = {};

                                        if (pResult.rows.length == 0) {
                                            _PrintError(objLogInfo, "ERR-SCN-80116", "No Attechment Types Info found");
                                        } else {
                                            for (var i = 0; i < pResult.rows.length; i++) {
                                                try {
                                                    var Attachmenttypes = {};
                                                    Attachmenttypes.at_code = pResult.rows[i].at_code;
                                                    Attachmenttypes.at_extensions = pResult.rows[i].at_extensions;
                                                    Attachmenttypes.at_description = pResult.rows[i].at_description;
                                                    Attachmenttypes.at_id = pResult.rows[i].at_id;
                                                    Attachmenttypes.at_id = pResult.rows[i].watermark_code;
                                                    arrattachmenttypes.push(Attachmenttypes);
                                                } catch (error) {
                                                    _PrintError(objLogInfo, "ERR-SCN-80117", "Error in Attachmenttypes" + error);
                                                }
                                            }

                                        }

                                    }
                                    attachtyperesult = JSON.stringify(arrattachmenttypes);
                                    callback();
                                });

                            } catch (error) {
                                _PrintError(objLogInfo, "ERR-SCN-80118", "Error in Attachment Types table" + error);
                            }
                        },
                        // // scan_setting == table 24
                        function (callback) {
                            try {
                                var arrscan = [];
                                var condst = new Object();
                                condst.scs_code = ['RANGER_SCAN', 'DEFAULT_SETTINGS'];
                                condst.tenant_id = TENANT_ID;
                                condst.client_id = CLIENT_ID;
                                //<?xml version='1.0'?><SCAN_SETTINGS xmlns:xsd='http://www.w3.org/2001/XMLSchema' xmlns:xsi='http://www.w3.org/2001/XMLSchema-instance'><SCANNER CODE='HP LASERJET M1210NF MFP TWAIN' DESCRIPTION='HP LASERJET M1210NF MFP TWAIN'><AUTO_RESOLVE><AUTO_BRIGHTNESS>true</AUTO_BRIGHTNESS><AUTO_DESKEW>true</AUTO_DESKEW><AUTO_DETECT_BARCODE>true</AUTO_DETECT_BARCODE><AUTO_DISCARD_BLANK_IMAGES>true</AUTO_DISCARD_BLANK_IMAGES><AUTO_PAPER_JAM>true</AUTO_PAPER_JAM><AUTO_ROTATE>90</AUTO_ROTATE><COMPRESSION>true</COMPRESSION></AUTO_RESOLVE><BRIGHTNESS>200</BRIGHTNESS><CONTRAST>500</CONTRAST><FEEDER_TYPE>FEEDER</FEEDER_TYPE><GAMMA>true</GAMMA><IMAGE_FORMAT>JPEG</IMAGE_FORMAT><ORIENTATION>PORTRAIT</ORIENTATION><PAGE_SIDE>ONESIDE</PAGE_SIDE><PAPER_SIZE>NONE</PAPER_SIZE><PIXEL_TYPE>COLOR</PIXEL_TYPE><RESOLUTION>200</RESOLUTION></SCANNER></SCAN_SETTINGS>
                                reqDBInstance.GetTableFromFXDB(cltcasClient, 'SCAN_SETTINGS', ['scan_options', 'scs_code'], condst, objLogInfo, function (err, pResult) {
                                    if (err)
                                        _PrintError(objLogInfo, "ERR-SCN-80119", err);
                                    else {
                                        var strParams = {};

                                        if (pResult.rows.length == 0) {
                                            // console.log('Scan_setting Records not found", "ERR-FX-10102');cmt
                                        } else {
                                            for (var i = 0; i < pResult.rows.length; i++) {
                                                try {
                                                    var getscantypes = {};
                                                    getscantypes.scs_code = pResult.rows[i].scs_code;
                                                    getscantypes.scan_options = pResult.rows[i].scan_options;
                                                    arrscan.push(getscantypes);

                                                } catch (error) {
                                                    scanresult = '';
                                                    callback();
                                                    //  _PrintError("ERR-SCN-80120", "Error in getscantypes" + error)
                                                }
                                            }

                                        }
                                    }
                                    scanresult = JSON.stringify(arrscan);
                                    callback();
                                });
                            } catch (error) {
                                scanresult = '';
                                callback();
                            }
                        },
                        // dt_types_data_templates == table 24
                        function (callback) {
                            try {
                                var paramresult = '';
                                var arrrelation_json = [];
                                var strpAppId = APP_ID;
                                var strpDTCode = DT_CODE;
                                var condrj = new Object();
                                condrj.app_id = APP_ID;
                                condrj.dt_code = DT_CODE;

                                reqDBInstance.GetTableFromFXDB(mClient, 'DT_INFO', ['relation_json'], condrj, objLogInfo, function (err, dtrelation_json) {
                                    if (err)
                                        _PrintError(objLogInfo, "ERR-SCN-80122", err);
                                    else {
                                        var objdatatemp = {};
                                        var objrelationjson = '{}';
                                        if (dtrelation_json.rows.length == 0) {
                                            console.log('No Relation JSON found", "ERR-FX-10102');
                                        } else {
                                            dtDATATEMPLATE_ENTITYRELATIO(dtrelation_json.rows, function (data) {
                                                callback();
                                                var hash = new Hash('APPLICATION_SETUP', '[]');
                                                arrHash.push(hash);

                                                //   getDtParams(); // table 2      
                                                var hash = new Hash('DT_PARAMS', dtparamresult.toString());
                                                arrHash.push(hash);

                                                // APP_HANDLERS // table 3
                                                var hash = new Hash('APP_HANDLERS', apphandlerresult);
                                                arrHash.push(hash);

                                                // DATA_TEMPLATE_DT_TYPES // table 4
                                                var hash = new Hash('DATA_TEMPLATE_DT_TYPES', DATA_TEMPLATE_DT_TYPESresult);
                                                arrHash.push(hash);

                                                // DT_TYPES // table 5
                                                var hash = new Hash('DT_TYPES', '[]');
                                                arrHash.push(hash);

                                                // DTT_ATTACHMENTS // table 6
                                                var hash = new Hash('DTT_ATTACHMENTS', dtattachmentresult);
                                                arrHash.push(hash);

                                                // DTTAD_IMAGE_FORMATS // table 7
                                                var hash = new Hash('DTTAD_IMAGE_FORMATS', '[]');
                                                arrHash.push(hash);

                                                // DTTA_DETAILS // table 8
                                                var hash = new Hash('DTTA_DETAILS', '[]');
                                                arrHash.push(hash);

                                                // ENTITY_KEY_COLUMNS // table 9
                                                var hash = new Hash('ENTITY_KEY_COLUMNS', ENTITY_KEY_COLUMNSresult);
                                                arrHash.push(hash);

                                                // DATA_FORMAT_DETAILS // table 10
                                                var hash = new Hash('DATA_FORMAT_DETAILS', '[]');
                                                arrHash.push(hash);

                                                //    // DT_TYPE_DATA_FORMATS // table 11
                                                var hash = new Hash('DT_TYPE_DATA_FORMATS', '[]');
                                                arrHash.push(hash);

                                                //    // WFTPA_PARAMS // table 12
                                                var hash = new Hash('WFTPA_PARAMS', '[]');
                                                arrHash.push(hash);

                                                //    // APP_USERS // TABLE 13
                                                var appresult = getappuser(APP_ID, APP_CODE, APP_DESCRIPTION, APPU_ID, UID); //table13
                                                var hash = new Hash('APP_USERS', appresult);
                                                arrHash.push(hash);

                                                //   // APPLICATIONS // table 14
                                                var hash = new Hash('APPLICATIONS', '[]');
                                                arrHash.push(hash);

                                                //   // ENTITY_RELATIONS // table 15
                                                var hash = new Hash('ENTITY_RELATIONS', '[]');
                                                arrHash.push(hash);

                                                //     // RESOURCE_SERVER // table 16
                                                var hash = new Hash('RESOURCE_SERVER', '[]');
                                                arrHash.push(hash);

                                                //    // CHILD_DTT // table 17
                                                var hash = new Hash('CHILD_DTT', '[]');
                                                arrHash.push(hash);

                                                //    // ACCESS_KEYS // table 18
                                                var hash = new Hash('ACCESS_KEYS', '[]');
                                                arrHash.push(hash);

                                                //    // DATA_TEMPLATES_FOLDERS // table 19
                                                var hash = new Hash('DATA_TEMPLATES_FOLDERS', '[]');
                                                arrHash.push(hash);

                                                //    // GET_SCAN_INFO // table 20
                                                var hash = new Hash('GET_SCAN_INFO', '[]');
                                                arrHash.push(hash);

                                                // GET_SCAN_INFO // table 21
                                                var hash = new Hash('ATTACHMENT_TYPES', attachtyperesult);
                                                arrHash.push(hash);

                                                //    // GET_DTT_TARGET_TABLES // table 22
                                                var hash = new Hash('GET_DTT_TARGET_TABLES', '[]');
                                                arrHash.push(hash);

                                                //    // SYSTEM_RESOURCE_SERVERS // table 23
                                                var hash = new Hash('SYSTEM_RESOURCE_SERVERS', '[]');
                                                arrHash.push(hash);

                                                // SYSTEM_RESOURCE_SERVERS // table 24
                                                var hash = new Hash('SCAN_SETTINGS', scanresult);
                                                arrHash.push(hash);
                                                //table 25
                                                var hash = new Hash('GetScaninfo', '[]');
                                                arrHash.push(hash);
                                                //table 26
                                                var hash = new Hash('ScannerInfo', '[]');
                                                arrHash.push(hash);


                                                console.log("Done!");
                                                hashresult = JSON.stringify(arrHash);
                                                callbackmain(hashresult);
                                            });

                                        }
                                    }
                                });
                            } catch (error) {
                                _PrintError(objLogInfo, "ERR-SCN-80123", "Error in dt_types_data_templates table" + error);
                            }
                        }
                    ],
                        function (err) {
                            try {
                                if (err) {
                                    _PrintError(objLogInfo, "ERR-SCN-80124", err);
                                } else {
                                    //   getApplicationsetup();// table 1


                                }

                            } catch (error) {
                                _PrintError(objLogInfo, "ERR-SCN-80125", "Error in hash table" + error);
                            }
                        });
                } catch (error) {
                    _PrintError(objLogInfo, "ERR-SCN-80215", "Catch Error in GetScanData function" + error);
                }
            }



            Attachmentvalues = '';

            function dtDATATEMPLATE_ENTITYRELATIO(dtParams, callback) {
                try {
                    var arrdtDATATEMPLATEParams = [];
                    var sort_order = 0;

                    for (var i = 0; i < dtParams.length; i++) {
                        var obj = dtParams[i];

                        Attachmentvalues = JSON.parse(obj.relation_json);
                        for (var j = 0; j < Attachmentvalues.length; j++) {
                            sort_order = sort_order + 1;
                            var CHILD_DTT_RELEATIONS = Attachmentvalues[j].CHILD_DTT_RELEATIONS;
                            if (CHILD_DTT_RELEATIONS == null) {
                                try {
                                    var dtDATATEMPLATEParams = {};
                                    dtDATATEMPLATEParams.DTT_CODE = Attachmentvalues[j].DTT_CODE;
                                    dtDATATEMPLATEParams.DT_CODE = DT_CODE;
                                    dtDATATEMPLATEParams.SORT_ORDER = sort_order;
                                    dtDATATEMPLATEParams.DTT_DESCRIPTION = Attachmentvalues[j].DTT_DESCRIPTION;
                                    dtDATATEMPLATEParams.PRIMARY_TABLE = Attachmentvalues[j].TARGET_TABLE;
                                    dtDATATEMPLATEParams.PRIMARY_COLUMN = Attachmentvalues[j].PRIMARY_COLUMN;
                                    dtDATATEMPLATEParams.DTT_CATAGORY = "S";
                                    dtDATATEMPLATEParams.FOREIGN_COLUMN = Attachmentvalues[j].FOREIGN_COLUMN;
                                    dtDATATEMPLATEParams.DTTYPES_DTCODE = Attachmentvalues[j].DTT_CODE;
                                    dtDATATEMPLATEParams.DTT_DTTCODE = Attachmentvalues[j].DTT_CODE;
                                    dtDATATEMPLATEParams.DTTT_DT_CODE = DT_CODE;
                                    dtDATATEMPLATEParams.ATTACHMENT_TABLE_NAME = "TRN_ATTACHMENTS";
                                    dtDATATEMPLATEParams.TARGET_TABLE = Attachmentvalues[j].TARGET_TABLE;
                                    dtDATATEMPLATEParams.FOREIGN_TABLE_NAME = Attachmentvalues[j].TARGET_TABLE;
                                    dtDATATEMPLATEParams.parent_dtt_code = "";
                                    dtDATATEMPLATEParams.FOLDER_STRUCTURE = "";
                                    dtDATATEMPLATEParams.FOLDER_NAME_PATTERN = "";
                                    dtDATATEMPLATEParams.FOLDER_NAME_TYPE = "";
                                    dtDATATEMPLATEParams.FOLDER_NAME = "";
                                    dtDATATEMPLATEParams.PRIMARY_TABLE_NAME = "";
                                    dtDATATEMPLATEParams.PRIMARY_KEY_COLUMN = "";
                                    dtDATATEMPLATEParams.FOREIGN_KEY_COLUMN = "";

                                    arrdtDATATEMPLATEParams.push(dtDATATEMPLATEParams);
                                } catch (error) {
                                    _PrintError("ERR-SCN-80126", "Error in CHILD_DTT_RELEATIONS IS NULL" + error);
                                }
                            } else if (CHILD_DTT_RELEATIONS != null) {
                                try {
                                    var dtDATATEMPLATEParams = {};
                                    dtDATATEMPLATEParams.DTT_CODE = Attachmentvalues[j].DTT_CODE;
                                    dtDATATEMPLATEParams.DT_CODE = DT_CODE;
                                    dtDATATEMPLATEParams.SORT_ORDER = sort_order;
                                    dtDATATEMPLATEParams.DTT_DESCRIPTION = Attachmentvalues[j].DTT_DESCRIPTION;
                                    dtDATATEMPLATEParams.PRIMARY_TABLE = Attachmentvalues[j].TARGET_TABLE;
                                    dtDATATEMPLATEParams.PRIMARY_COLUMN = Attachmentvalues[j].PRIMARY_COLUMN;
                                    dtDATATEMPLATEParams.DTT_CATAGORY = "S";
                                    dtDATATEMPLATEParams.FOREIGN_COLUMN = Attachmentvalues[j].FOREIGN_COLUMN;
                                    dtDATATEMPLATEParams.DTTYPES_DTCODE = Attachmentvalues[j].DTT_CODE;
                                    dtDATATEMPLATEParams.DTT_DTTCODE = Attachmentvalues[j].DTT_CODE;
                                    dtDATATEMPLATEParams.DTTT_DT_CODE = DT_CODE;
                                    dtDATATEMPLATEParams.ATTACHMENT_TABLE_NAME = "TRN_ATTACHMENTS";
                                    dtDATATEMPLATEParams.TARGET_TABLE = Attachmentvalues[j].TARGET_TABLE;
                                    dtDATATEMPLATEParams.FOREIGN_TABLE_NAME = Attachmentvalues[j].TARGET_TABLE;
                                    dtDATATEMPLATEParams.PARENT_DTT_CODE = "";
                                    dtDATATEMPLATEParams.FOLDER_STRUCTURE = "";
                                    dtDATATEMPLATEParams.FOLDER_NAME_PATTERN = "";
                                    dtDATATEMPLATEParams.FOLDER_NAME_TYPE = "";
                                    dtDATATEMPLATEParams.FOLDER_NAME = "";
                                    dtDATATEMPLATEParams.PRIMARY_TABLE_NAME = "";
                                    dtDATATEMPLATEParams.PRIMARY_KEY_COLUMN = "";
                                    dtDATATEMPLATEParams.FOREIGN_KEY_COLUMN = "";

                                    arrdtDATATEMPLATEParams.push(dtDATATEMPLATEParams);

                                    for (var k = 0; k < CHILD_DTT_RELEATIONS.length; k++) {
                                        var dtDATATEMPLATEParams = {};
                                        dtDATATEMPLATEParams.DTT_CODE = CHILD_DTT_RELEATIONS[k].DTT_CODE;
                                        dtDATATEMPLATEParams.DT_CODE = DT_CODE;
                                        dtDATATEMPLATEParams.SORT_ORDER = sort_order;
                                        dtDATATEMPLATEParams.DTT_DESCRIPTION = CHILD_DTT_RELEATIONS[k].DTT_CODE;
                                        dtDATATEMPLATEParams.PRIMARY_TABLE = CHILD_DTT_RELEATIONS[k].TARGET_TABLE;
                                        dtDATATEMPLATEParams.PRIMARY_COLUMN = CHILD_DTT_RELEATIONS[k].PRIMARY_COLUMN;
                                        dtDATATEMPLATEParams.DTT_CATAGORY = "S";
                                        dtDATATEMPLATEParams.FOREIGN_COLUMN = CHILD_DTT_RELEATIONS[k].FOREIGN_COLUMN;
                                        dtDATATEMPLATEParams.DTTYPES_DTCODE = CHILD_DTT_RELEATIONS[k].DTT_CODE;
                                        dtDATATEMPLATEParams.DTT_DTTCODE = CHILD_DTT_RELEATIONS[k].DTT_CODE;
                                        dtDATATEMPLATEParams.DTTT_DT_CODE = DT_CODE;
                                        dtDATATEMPLATEParams.ATTACHMENT_TABLE_NAME = "TRN_ATTACHMENTS";
                                        dtDATATEMPLATEParams.TARGET_TABLE = CHILD_DTT_RELEATIONS[k].TARGET_TABLE;
                                        dtDATATEMPLATEParams.FOREIGN_TABLE_NAME = Attachmentvalues[j].TARGET_TABLE;
                                        dtDATATEMPLATEParams.PARENT_DTT_CODE = Attachmentvalues[j].DTT_CODE;
                                        dtDATATEMPLATEParams.FOLDER_STRUCTURE = "";
                                        dtDATATEMPLATEParams.FOLDER_NAME_PATTERN = "";
                                        dtDATATEMPLATEParams.FOLDER_NAME_TYPE = "";
                                        dtDATATEMPLATEParams.FOLDER_NAME = "";
                                        dtDATATEMPLATEParams.PRIMARY_TABLE_NAME = CHILD_DTT_RELEATIONS[k].TARGET_TABLE;
                                        dtDATATEMPLATEParams.PRIMARY_KEY_COLUMN = CHILD_DTT_RELEATIONS[k].PRIMARY_COLUMN;
                                        dtDATATEMPLATEParams.FOREIGN_KEY_COLUMN = "";
                                        //  ENTITY_KEY_COLUMNSresult(arrdtDATATEMPLATEParams);
                                        arrdtDATATEMPLATEParams.push(dtDATATEMPLATEParams);
                                    }
                                } catch (error) {
                                    _PrintError("ERR-SCN-80127", "Error in CHILD_DTT_RELEATIONS IS NOT NULL" + error);
                                }
                            }
                        }
                    }
                    getENTITY_KEY_COLUMNS(arrdtDATATEMPLATEParams);
                    getdtAttachment(arrdtDATATEMPLATEParams, function () {
                        DATA_TEMPLATE_DT_TYPESresult = JSON.stringify(arrdtDATATEMPLATEParams);
                        callback();
                    });

                } catch (error) {
                    _PrintError("ERR-SCN-80128", "Error in dtDATATEMPLATE_ENTITYRELATION function" + error);
                }
            }


            function getdtAttachment(arrdtDATATEMPLATEParams, callback) {
                try {
                    var strdttcodes = [];
                    for (var i = 0; i < arrdtDATATEMPLATEParams.length; i++) {
                        strdttcodes.push(arrdtDATATEMPLATEParams[i].DTT_CODE);
                        console.log('dtt_code');
                        console.log(arrdtDATATEMPLATEParams[i].DTT_CODE);
                    }
                    var conddtt = new Object();
                    conddtt.app_id = APP_ID;
                    conddtt.dtt_code = strdttcodes;
                    console.log('App Id is');
                    console.log(APP_ID);


                    reqDBInstance.GetTableFromFXDB(mClient, 'DTT_INFO', ['dtt_dfd_json', 'dtt_code'], conddtt, objLogInfo, function (err, dtAttachmentrowsresult) {

                        if (err)
                            _PrintError("ERR-SCN-80129", err);
                        else {
                            var arrattachmentresult = [];
                            var sortorder = 0;
                            var attachmentresult_dtt_code = '';
                            var dtAttachmentrows = dtAttachmentrowsresult.rows;
                            _PrintInfo(objLogInfo, 'DT Attachment Rows - ' + dtAttachmentrows.length);
                            console.log(dtAttachmentrows.length);
                            for (var i = 0; i < dtAttachmentrows.length; i++) {
                                var obj = dtAttachmentrows[i];
                                var dtt_dfd_jsonvalue = obj.dtt_dfd_json;
                                attachmentresult_dtt_code = obj.dtt_code;
                                var str = dtt_dfd_jsonvalue.replace(/\\/g, '');
                                var Attachmentvalues = JSON.parse(str);

                                for (var intda = 0; intda < Attachmentvalues.DTT_ATTACHMENT.length; intda++) {
                                    var DTT_ATTACH_values = Attachmentvalues.DTT_ATTACHMENT[intda];

                                    for (var intdad = 0; intdad < DTT_ATTACH_values.DTTA_DETAILS.length; intdad++) {
                                        var dtt_attach_details = DTT_ATTACH_values.DTTA_DETAILS[intdad];
                                        if (dtt_attach_details.DTTAD_IMG_FORMAT.length == 0) {
                                            try {
                                                var objdtimageformats = new dtimageformats();
                                                objdtimageformats.DTTAD_ID = dtt_attach_details.DTTAD_ID;
                                                objdtimageformats.IMAGE_COLOR = '';
                                                objdtimageformats.IMAGE_FORMAT = 'JPEG';
                                                objdtimageformats.RESOULTION = '100';
                                                objdtimageformats.COMPRESSION = '';
                                                objdtimageformats.IS_DEFAULT = 'Y';
                                                objdtimageformats.DTTA_ID = DTT_ATTACH_values.DTTA_ID;
                                                objdtimageformats.DT_CODE = DT_CODE;
                                                objdtimageformats.DTT_CODE = attachmentresult_dtt_code;
                                                objdtimageformats.ATTACHMENT_TITLE = DTT_ATTACH_values.ATTACH_TITLE;
                                                objdtimageformats.ATTACHMENT_SOURCE = 'SCAN';
                                                objdtimageformats.AT_CODE = 'IMG';
                                                objdtimageformats.SORT_ORDER = sortorder;
                                                objdtimageformats.DTTAD_ID = dtt_attach_details.DTTAD_ID;
                                                objdtimageformats.IMAGE_SIDE = dtt_attach_details.IMG_SIDE;
                                                objdtimageformats.IMAGE_LABEL_NAME = dtt_attach_details.LABEL_NAME;
                                                objdtimageformats.PAGE_NO = '1';
                                                arrattachmentresult.push(objdtimageformats);
                                                sortorder = sortorder + 1;
                                            } catch (error) {
                                                _PrintError("ERR-SCN-80130", "Error in objdtimageformats" + error);
                                            }
                                        } else {
                                            for (var ifmt = 0; ifmt < dtt_attach_details.DTTAD_IMG_FORMAT.length; ifmt++) {
                                                try {
                                                    var drimageformats = {};
                                                    var dttad_image_formats = dtt_attach_details.DTTAD_IMG_FORMAT[ifmt];
                                                    drimageformats.DTTAD_ID = dtt_attach_details.DTTAD_ID;
                                                    drimageformats.IMAGE_COLOR = dttad_image_formats.IMG_COLOR;
                                                    drimageformats.IMAGE_FORMAT = dttad_image_formats.IMG_FORMAT;
                                                    drimageformats.RESOULTION = dttad_image_formats.RESOLUTION;
                                                    drimageformats.COMPRESSION = dttad_image_formats.COMPRESSION;
                                                    drimageformats.IS_DEFAULT = 'Y';
                                                    drimageformats.DTTA_ID = DTT_ATTACH_values.DTTA_ID;
                                                    drimageformats.DT_CODE = DT_CODE;
                                                    drimageformats.DTT_CODE = attachmentresult_dtt_code;
                                                    drimageformats.ATTACHMENT_TITLE = DTT_ATTACH_values.ATTACH_TITLE;
                                                    drimageformats.ATTACHMENT_SOURCE = 'SCAN';
                                                    drimageformats.AT_CODE = 'IMG';
                                                    drimageformats.SORT_ORDER = sortorder;
                                                    drimageformats.DTTAD_ID = dtt_attach_details.DTTAD_ID;
                                                    drimageformats.IMAGE_SIDE = dtt_attach_details.IMG_SIDE;
                                                    drimageformats.IMAGE_LABEL_NAME = dtt_attach_details.LABEL_NAME;

                                                    arrattachmentresult.push(drimageformats);
                                                    sortorder = sortorder + 1;
                                                } catch (error) {
                                                    _PrintError("ERR-SCN-80131", "Error in drimageformats" + error);
                                                }
                                            }

                                        }
                                    }
                                }
                            }
                            dtattachmentresult = JSON.stringify(arrattachmentresult);
                        }
                        callback();
                    });
                } catch (error) {
                    _PrintError("ERR-SCN-80132", "Error in getdtAttachment function" + error);
                }
            }

            function getENTITY_KEY_COLUMNS(arrdtDATATEMPLATEParams) {
                try {
                    var arrEntity = [];
                    for (var i = 0; i < arrdtDATATEMPLATEParams.length; i++) {
                        var dtobjentity = new dtentity();
                        if (arrdtDATATEMPLATEParams[i].PRIMARY_TABLE_NAME != '' && arrdtDATATEMPLATEParams[i].PRIMARY_KEY_COLUMN != '') {
                            var dtprimaryentity = new dtentity();
                            dtprimaryentity.TABLE_NAME = arrdtDATATEMPLATEParams[i].PRIMARY_TABLE_NAME;
                            dtprimaryentity.KEY_COLUMN = arrdtDATATEMPLATEParams[i].PRIMARY_KEY_COLUMN;
                            arrEntity.push(dtprimaryentity);
                        }
                        dtobjentity.TABLE_NAME = arrdtDATATEMPLATEParams[i].PRIMARY_TABLE;
                        dtobjentity.KEY_COLUMN = arrdtDATATEMPLATEParams[i].PRIMARY_COLUMN;
                        arrEntity.push(dtobjentity);
                    }
                    ENTITY_KEY_COLUMNSresult = JSON.stringify(arrEntity); //table9
                } catch (error) {
                    _PrintError("ERR-SCN-80133", "Error in getENTITY_KEY_COLUMNS function" + error);
                }
            }


            function getappuser(APP_ID, APP_CODE, APP_DESCRIPTION, APPU_ID, UID) {
                var arrappuser = [];
                var getappuserparams = {};
                getappuserparams.App_Id = APP_ID;
                getappuserparams.APP_CODE = APP_CODE;
                getappuserparams.APP_DESCRIPTION = APP_DESCRIPTION;
                getappuserparams.APPU_ID = APPU_ID;
                getappuserparams.UID = UID;
                getappuserparams.OCRAPI = apiresult;
                arrappuser.push(getappuserparams);

                var appuserresult = JSON.stringify(arrappuser);
                return appuserresult;
            }

            // Classes used in Scan process

            function dtentity() {
                this.TABLE_NAME = '';
                this.KEY_COLUMN = '';
            }

            function getappuserparams() {
                this.App_Id = '';
                this.APP_CODE = '';
                this.APP_DESCRIPTION = '';
                this.APPU_ID = '';
                this.UID = '';
                this.appuserresult = '';
            }

            function getAttachmentTypes() {

            }

            function Attachmenttypes() {
                this.at_id = '';
                this.AT_CODE = '';
                this.AT_EXTENSIONS = '';
                this.AT_DESCRIPTION = '';
                this.WATERMARK_CODE = '';

            }

            function getscantypes() {
                this.scan_options = '';
                this.scs_code = '';
            }

            function Hash(pobjectname, pobjectvalue) {
                this.objectname = pobjectname;
                this.objectvalue = pobjectvalue;
            }

            function DTParams() {
                this.WFTPA_ID = '';
                this.dt_cODE = '';
                this.DTP_PARAM_NAME = '';
                this.DTP_CATEGORY = '';
                this.DTP_PARAM_VALUE = '';
            }

            function objapphanler() {
                this.ah_code = '';
                this.assembly_full_name = '';
                this.ah_category = '';
            }

            function dtimageformats() {
                this.DTTAD_ID = '';
                this.IMAGE_COLOR = '';
                this.IMAGE_FORMAT = '';
                this.RESOULTION = '';
                this.COMPRESSION = '';
                this.IS_DEFAULT = '';
                this.DTTA_ID = '';
                this.DT_CODE = '';
                this.DTT_CODE = '';
                this.ATTACHMENT_TITLE = '';
                this.ATTACHMENT_SOURCE = '';
                this.AT_CODE = '';
                this.SORT_ORDER = '';
                this.DTTAD_ID = '';
                this.IMAGE_SIDE = '';
                this.IMAGE_LABEL_NAME = '';
                this.PAGE_NO = '';
            }

            function dtDATATEMPLATEParams() {
                this.DTT_CODE = '';
                this.DTTYPES_DTCODE = '';
                this.DTT_DTTCODE = '';
                this.DTTT_DT_CODE = '';
                this.ATTACHMENT_TABLE_NAME = '';
                this.TARGET_TABLE = '';
                this.DT_CODE = '';
                this.SORT_ORDER = '';
                this.DTT_DESCRIPTION = '';
                this.PRIMARY_TABLE = '';
                this.PRIMARY_COLUMN = '';
                this.DTT_CATAGORY = '';
                this.FOREIGN_COLUMN = '';
                this.PRIMARY_TABLE_NAME = '';
                this.PRIMARY_KEY_COLUMN = '';
                this.FOREIGN_TABLE_NAME = '';
                this.FOREIGN_KEY_COLUMN = '';
                this.PARENT_DTT_CODE = '';
                this.FOLDER_STRUCTURE = '';
                this.FOLDER_NAME_PATTERN = '';
                this.FOLDER_NAME_TYPE = '';
                this.FOLDER_NAME = '';
            }

            function objrelationjson() {
                this.relation_json = '';
            }
            /* End of GetScanData */

            // Common function to print log messages
            function _PrintInfo(pLogInfo, pMessage) {
                reqInstanceHelper.PrintInfo(strServiceName, pMessage, pLogInfo);
            }
            function _PrintError(pLogInfo, pErrcode, pMessage) {
                reqLogWriter.TraceError(pLogInfo, pMessage, pErrcode);
                appResponse.send(pMessage + " " + pErrcode);
                // Prepare callback object
                function _PrepareAndSendCallback(pStatus, pQueryResult, pLockingMode, pErrorCode, pErrMsg, pError, pWarning, pSolrSearch, pTotalRecords, pTokenID, pCallback) {
                    var objCallback = {
                        Status: pStatus,
                        ErrorCode: pErrorCode,
                        ErrorMsg: pErrMsg,
                        Error: pError,
                        Warning: pWarning,
                        QueryResult: pQueryResult,
                        LockingMode: pLockingMode,
                        TotalRecords: pTotalRecords
                    };
                    return pCallback(objCallback, pSolrSearch, pTotalRecords, pTokenID);
                }
            }
        } catch (error) {

        }
    });

});
module.exports = router;