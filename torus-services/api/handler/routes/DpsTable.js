/**
@Api_Name           : /DpsTable,
@Description        : To query a particular table from transaction DB with or without condition
@Last_Error_code    : ERR-HAN-41320
*/

// Require dependencies
var reqExpress = require('express');
var reqUtil = require('util');
var router = reqExpress.Router();
var reqTranDBHelper = require('../../../../torus-references/instance/TranDBInstance')
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqStringBuilder = require('string-builder');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var serviceName = 'DpsTable';
var reqCacheRedisInstance = require('../../../../torus-references/instance/CacheRedisInstance');
var reqEncryptionInstance = require('../../../../torus-references/common/crypto/EncryptionInstance');
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');

// Host api to server
router.post('/DpsTable', function (appRequest, appResponse, next) {

    var mTranDB;
    var objLogInfo = '';
    var isCacheEnabled = false;
    var cacheExpireMin = 1;
    try {
        // Handle the api close event from when client close the request
        appResponse.on('close', function () { });
        appResponse.on('finish', function () { });
        appResponse.on('end', function () { });

        reqLogInfo.AssignLogInfoDetail(appRequest, function (LogInfo, session_info) {
            // Initialize local variables
            objLogInfo = LogInfo;
            var strInputParamJson = Buffer.from(appRequest.body.PARAMS, 'base64').toString('ascii');
            strInputParamJson = JSON.parse(strInputParamJson);
            var strACTION_DESC = strInputParamJson.ACTION_DESC;
            var strAPP_DESC = strInputParamJson.APP_DESC;
            var strAPP_ID = session_info.APP_ID;
            var strCLIENT_ID = session_info.CLIENT_ID;
            var strCLUSTER_CODE = strInputParamJson.CLUSTER_CODE;
            var strCONTEXT = strInputParamJson.CONTEXT;
            var strDISPLAY_MEMBER = strInputParamJson.DISPLAY_MEMBER;
            var strFILTERS = strInputParamJson.FILTERS;
            var strFIRST_RECORD_DISPLAY = strInputParamJson.FIRST_RECORD_DISPLAY;
            var strMENU_ITEM_DESC = strInputParamJson.MENU_ITEM_DESC;
            var strORDER_BY = strInputParamJson.ORDER_BY;
            var strSESSION_ID = strInputParamJson.SESSION_ID;
            var strSTS_ID = session_info.STS_ID;
            var strSYSTEM_DESC = session_info.SYSTEM_DESC;
            var strSYSTEM_ID = session_info.SYSTEM_ID;
            var strS_ID = strInputParamJson.S_ID;
            var strTABLENAME = strInputParamJson.TABLENAME;
            var strTYPE = strInputParamJson.TYPE;
            var strUSER_ID = strInputParamJson.rUSER_ID;
            var strUSER_NAME = session_info.USER_NAME;
            var strU_ID = session_info.U_ID;
            var strVALUE_MEMBER = strInputParamJson.VALUE_MEMBER;
            var strSelectedColumn = strInputParamJson.SELECTED_COLUMNS;
            var needNot_Null = strInputParamJson.NEED_NOT_NULL;
            isCacheEnabled = strInputParamJson.NEED_CACHE;
            cacheExpireMin = strInputParamJson.CACHE_TIME;
            var headers = appRequest.headers;
            var Condn = '';
            var strOrm = 'knex';
            var ClmnDetails = {}
            var arrColumnDet = [];
            var RowCnt = '0'
            var strRowContent = {};
            var NotVisibleColumnContent = '';
            var TemplateContent = '';
            var TemplateBehaviour = '';
            var TemplateSaveParams = '';
            var RecordPerPage = '0';
            var RecordDisplay = 'Record(0to0)of 0';
            var PageDisplay = 'of 0';
            var ChartTicks = null;
            var Series = null;
            var NeedCheckBox = '';
            var DisplayMember = '';
            var ValueMember = '';
            var BindingCode = '';
            var ListingMode = '';
            var LockingMode = '';
            var arrRows = [];
            var arrFields = [];
            var strVM = '';
            var strQury;

            objLogInfo.HANDLER_CODE = 'DPS_TABLE';

            _PrintInfo('Begin');
            reqTranDBHelper.GetTranDBConn(headers, false, function (pSession) {
                mTranDB = pSession;
                _DpsTableContent();
            });

            // Query a table data from transaction db
            function _DpsTableContent() {
                try {
                    var strMember = {}
                    if (strTABLENAME.toUpperCase() == 'TRN_COMPANY_USR_DETAILS') {
                        _PrintInfo('Table name is TRN_COMPANY_USR_DETAILS. Hence query only display member and value member columns.');
                        strQury = "Select " + strDISPLAY_MEMBER + "," + strVALUE_MEMBER + " from " + strTABLENAME.toLowerCase();
                    } else if (strSelectedColumn != '' && strSelectedColumn != undefined) {
                        var splitSelectedColumn = strSelectedColumn.split(',')
                        // To remove strDISPLAY_MEMBER column from selected column if 
                        for (var m = 0; m < splitSelectedColumn.length; m++) {
                            var dmIndex = strDISPLAY_MEMBER.indexOf(splitSelectedColumn[m]);
                            if (dmIndex > -1) {
                                splitSelectedColumn.splice(dmIndex, 1);
                                break;
                            }
                        }

                        // To remove strVALUE_MEMBER column from selected column if 
                        for (var n = 0; n < splitSelectedColumn.length; n++) {
                            var vmIndex = strVALUE_MEMBER.indexOf(splitSelectedColumn[n]);
                            if (vmIndex > -1) {
                                splitSelectedColumn.splice(vmIndex, 1);
                                break;
                            }
                        }
                        if (splitSelectedColumn.length > 0) {
                            if (strDISPLAY_MEMBER == strVALUE_MEMBER) {
                                // DisplayMember and ValueMember are same Select any one column to prepare query
                                strQury = "Select " + strDISPLAY_MEMBER + ", " + splitSelectedColumn + " from " + strTABLENAME.toLowerCase();
                            } else {
                                strQury = "Select " + strDISPLAY_MEMBER + ", " + strVALUE_MEMBER + "," + splitSelectedColumn + " from " + strTABLENAME.toLowerCase();
                            }
                        } else {
                            strQury = "Select " + strDISPLAY_MEMBER + ", " + strVALUE_MEMBER + " from " + strTABLENAME.toLowerCase();
                        }
                    } else {
                        strQury = "Select *  from " + strTABLENAME.toLowerCase();
                    }



                    if (strFIRST_RECORD_DISPLAY != '') {
                        if (strDISPLAY_MEMBER == strVALUE_MEMBER) {
                            strVM = strDISPLAY_MEMBER + '_1';
                            strMember[strDISPLAY_MEMBER] = strFIRST_RECORD_DISPLAY;
                            strMember[strVM] = 'null';
                        } else {
                            strMember[strDISPLAY_MEMBER] = strFIRST_RECORD_DISPLAY;
                            strMember[strVALUE_MEMBER] = 'null';
                        }
                        arrRows.push(strMember);
                    }


                    //for (i = 0; i < strFILTERS[i].length; i++) {
                    if (strFILTERS) {
                        _PrintInfo('Prepare Filter condtion loop executing...')
                        var strFill = JSON.parse(strFILTERS);
                        var strConjOptr = 'AND';
                        for (var j = 0; j < strFill.length; j++) {
                            if (strFill[j].SOURCE_NAME == 'CONDITION' && strFill[j].SOURCE_VALUE != '') {
                                if (Condn != '') {
                                    Condn += ' ' + strConjOptr + ' ' + strFill[j].SOURCE_VALUE
                                } else {
                                    Condn = strFill[j].SOURCE_VALUE;
                                }
                            }

                            if (strFill[j].OPRTR == "IS NULL" || strFill[j].OPRTR == "IS NOT NULL") {
                                if (Condn != '') {
                                    Condn += ' ' + strConjOptr + ' COALESCE(' + strFill[j].BINDING_NAME + ', NULL)' + strFill[j].OPRTR;
                                } else {
                                    Condn = ' COALESCE(' + strFill[j].BINDING_NAME + ', NULL)' + strFill[j].OPRTR;
                                }
                            }

                            if (strFill[j].BINDING_VALUE == undefined || strFill[j].BINDING_VALUE == null || (strFill[j].BINDING_VALUE == '' && needNot_Null != 'Y')) {
                                continue;
                            }

                            if (strFill[j].OPRTR == "=") {
                                if ((needNot_Null == 'Y' && strFill[j].BINDING_VALUE == '') || (strFill[j].BINDING_VALUE != '')) {
                                    if (strFill[j].DATA_TYPE == 'DATE' || strFill[j].DATA_TYPE == 'DATETIME') {
                                        var strValue = reqUtil.format(" TO_DATE(TO_CHAR(cast('%s' as TIMESTAMP),'DD-MON-YY'),'DD-MON-YY')", ToDate(strFill[j].BINDING_VALUE))
                                        var strTRNCondition = reqUtil.format(" TO_DATE(TO_CHAR(%s,'DD-MON-YY'),'DD-MON-YY') %s %s", strFill[j].BINDING_NAME, '=', strValue)
                                        if (Condn != '') {
                                            Condn += ' ' + strConjOptr + ' ' + strTRNCondition;
                                        } else {
                                            Condn = strTRNCondition
                                        }
                                    } else {
                                        if (Condn != '') {
                                            Condn += ' ' + strConjOptr + ' ' + strFill[j].BINDING_NAME + '=\'' + strFill[j].BINDING_VALUE + '\'';
                                        } else {
                                            Condn = strFill[j].BINDING_NAME + '=\'' + strFill[j].BINDING_VALUE + '\'';
                                        }
                                    }
                                }
                            } else if (strFill[j].OPRTR == 'STARTS') {
                                _PrintInfo('Enter into  "STARTS"   Operator, prepare like query.');
                                if ((needNot_Null == 'Y' && strFill[j].BINDING_VALUE == '') || strFill[j].BINDING_VALUE != '') {
                                    if (Condn != '') {
                                        _PrintInfo('Condn is already created, added another condition');
                                        Condn = Condn + ' ' + strConjOptr + " UPPER (CAST(" + strFill[j].BINDING_NAME + " as varchar(256))) LIKE UPPER ('" + strFill[j].BINDING_VALUE + "%')"
                                    } else {
                                        Condn = " UPPER (CAST(" + strFill[j].BINDING_NAME + " as varchar(256))) LIKE UPPER('" + strFill[j].BINDING_VALUE + "%')"
                                    }
                                }
                            } else if (strFill[j].OPRTR == 'CONTAINS') {
                                _PrintInfo('Enter into  "CONTAINS"   Operator, prepare like query.');
                                if ((needNot_Null == 'Y' && strFill[j].BINDING_VALUE == '') || (strFill[j].BINDING_VALUE != '')) {
                                    if (Condn != '') {
                                        Condn = Condn + ' ' + strConjOptr + " UPPER (CAST(" + strFill[j].BINDING_NAME + " as varchar(256))) LIKE UPPER ('%" + strFill[j].BINDING_VALUE + "%')"
                                    } else {
                                        Condn = " UPPER (CAST(" + strFill[j].BINDING_NAME + " as varchar(256))) LIKE UPPER('%" + strFill[j].BINDING_VALUE + "%')"
                                    }
                                }
                            }
                            // Edited By UdhayaRaj on 25-01-2017
                            else if (strFill[j].OPRTR == "IN") {
                                _PrintInfo('Enter into IN  Operator condition');
                                var sbcond = new reqStringBuilder();
                                if ((needNot_Null == 'Y' && strFill[j].BINDING_VALUE == '') || strFill[j].BINDING_VALUE != '') {
                                    var splltBindname = []
                                    if (typeof strFill[j].BINDING_VALUE == 'number') {
                                        splltBindname.push(strFill[j].BINDING_VALUE)
                                    } else {
                                        splltBindname = strFill[j].BINDING_VALUE.split(',')
                                    }
                                    sbcond.append('(')
                                    for (var k = 0; k < splltBindname.length; k++) {
                                        if (k > 0) {
                                            sbcond.append(',')
                                        }
                                        sbcond.append("'");
                                        sbcond.append(splltBindname[k]);
                                        sbcond.append("'");
                                    }
                                    sbcond.append(')')
                                }
                                if (Condn != '')
                                    Condn += ' ' + strConjOptr + ' ' + strFill[j].BINDING_NAME + ' IN ' + sbcond.toString();
                                else
                                    Condn = strFill[j].BINDING_NAME + ' IN ' + sbcond.toString();

                            } else if (strFill[j].OPRTR == "NOT IN") {
                                _PrintInfo('Enter into NOT IN  Operator condition');
                                var sbcond = new reqStringBuilder();
                                if ((needNot_Null == 'Y' && strFill[j].BINDING_VALUE == '') || strFill[j].BINDING_VALUE != '') {
                                    var splltBindname = strFill[j].BINDING_VALUE.split(',')

                                    sbcond.append('(')
                                    for (var l = 0; l < splltBindname.length; l++) {
                                        if (l > 0) {
                                            sbcond.append(',')
                                        }
                                        (strFill[j].DATA_TYPE != 'NUMBER') ? sbcond.append("'") : sbcond.append("");
                                        sbcond.append(splltBindname[l]);
                                        (strFill[j].DATA_TYPE != 'NUMBER') ? sbcond.append("'") : sbcond.append("");
                                    }
                                    sbcond.append(')')
                                }
                                if (Condn != '')
                                    Condn += ' ' + strConjOptr + ' ' + strFill[j].BINDING_NAME + ' NOT IN ' + sbcond.toString();
                                else
                                    Condn = strFill[j].BINDING_NAME + ' NOT IN ' + sbcond.toString();
                            } else {
                                _PrintInfo('Enter into else case condition');
                                if (strFill[j].DATA_TYPE == 'DATE' || strFill[j].DATA_TYPE == 'DATETIME') {
                                    var strValue = reqUtil.format(" TO_DATE(TO_CHAR(cast('%s' as TIMESTAMP),'DD-MON-YY'),'DD-MON-YY')", ToDate(strFill[j].BINDING_VALUE))
                                    var strTRNCondition = reqUtil.format(" TO_DATE(TO_CHAR(%s,'DD-MON-YY'),'DD-MON-YY') %s %s", strFill[j].BINDING_NAME, '=', strValue)
                                    if (Condn != '') {
                                        Condn += ' ' + strConjOptr + ' ' + strTRNCondition;
                                    } else {
                                        Condn = strTRNCondition
                                    }
                                } else {
                                    var strBindVal = (strFill[j].DATA_TYPE == 'NUMBER') ? strFill[j].BINDING_VALUE : "'" + strFill[j].BINDING_VALUE + "'";

                                    if (Condn != '')
                                        Condn += ' ' + strConjOptr + ' ' + strFill[j].BINDING_NAME + strFill[j].OPRTR + strBindVal;
                                    else
                                        Condn = strFill[j].BINDING_NAME + strFill[j].OPRTR + strBindVal;
                                }
                            }
                            strConjOptr = (strFill[j].CONJ_OPERATOR == undefined || strFill[j].CONJ_OPERATOR == null || strFill[j].CONJ_OPERATOR == '') ? 'AND' : strFill[j].CONJ_OPERATOR;
                        }
                    }
                    // reqCacheRedisInstance.GetRedisConnection(headers, function (redisClient) {
                    //     try {
                    //         var redisDB = redisClient['db1']; // db1 for tran cache
                    var uniquRedisKey = '';
                    //add filter if available
                    if (Condn != '') {
                        strQury = strQury + ' where ' + Condn;

                        //Add order by condition if available
                        if (strORDER_BY != '') {
                            strQury = strQury + ' order by ' + strORDER_BY;
                        }
                        uniquRedisKey = 'TRAN_CACHE~' + reqEncryptionInstance.EncryptPassword(strQury);

                        _PrintInfo('Current Redis Cache Key Name - ' + uniquRedisKey);

                        function afterQueryExecution(pError, pResult) {
                            try {
                                if (pResult) {
                                    RowCnt = pResult.rows.length;
                                    _PrintInfo('Table rows returned - ' + RowCnt)
                                    if (strDISPLAY_MEMBER != strVALUE_MEMBER) {
                                        for (var b = 0; b < pResult.rows.length; b++) {
                                            var obiRow = pResult.rows[b];
                                            obiRow.FX_KEY_COLUMN = '';
                                            arrRows.push(obiRow)
                                        }
                                    } else {
                                        for (var c = 0; c < pResult.rows.length; c++) {
                                            var obiRow = pResult.rows[c];
                                            obiRow.FX_KEY_COLUMN = '';
                                            obiRow[strVM] = obiRow[strDISPLAY_MEMBER.toLowerCase()];
                                            arrRows.push(obiRow)
                                        }
                                    }
                                    arrFields = pResult.fields;
                                    if (arrFields.length > 0) {
                                        for (var a = 0; a < arrFields.length; a++) {
                                            ClmnDetails = {}
                                            ClmnDetails.Name = arrFields[a].name;
                                            ClmnDetails.Header = arrFields[a].name;
                                            ClmnDetails.Width = 'Auto';
                                            ClmnDetails.Format = '';
                                            arrColumnDet.push(ClmnDetails);
                                        }
                                        if (arrColumnDet.length > 0) {
                                            _RelJsonForm();
                                        }
                                    } else
                                        _RelJsonForm();

                                } else if (pError) {
                                    reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-41301', 'Error In ' + strQury, pError);
                                } else {
                                    var errorMsg = 'There is No Cache Data Available From the Cache Redis For Redis Key - ' + uniquRedisKey;
                                    _PrintInfo(errorMsg);
                                    reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-41320', errorMsg, '');
                                }
                            } catch (error) {
                                reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-41302', 'Error In _DpsTableContent-strQury execution:', error);
                            }
                        }



                        function executeQuery() {
                            try {
                                _PrintInfo('Gogin to execute prepared query');
                                reqTranDBHelper.ExecuteSQLQuery(mTranDB, strQury, objLogInfo, function (pResult, pError) {
                                    try {
                                        if (isCacheEnabled && pResult) {
                                            var params = {
                                                db: 'db1',
                                                uniquKey: uniquRedisKey,
                                                expirMin: cacheExpireMin,
                                                value: JSON.stringify(pResult)
                                            };
                                            reqCacheRedisInstance.AddCacheToRedis(headers, params, objLogInfo, function (result) {
                                                try {
                                                    if (result != 'SUCCESS') {
                                                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-HAN-41309', 'Error on AddCacheToRedis', result);
                                                    } else {
                                                        reqInstanceHelper.PrintInfo(serviceName, 'Cache added.', objLogInfo);
                                                    }
                                                } catch (error) {
                                                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-HAN-41310', 'Error on AddCacheToRedis', error);
                                                }
                                            });
                                            // reqCacheRedisInstance.SetKeyValWithExpiry(redisDB, objLogInfo, uniquRedisKey, JSON.stringify(pResult), cacheExpireMin, function (error, result) {
                                            //     try {
                                            //         if (error) {
                                            //             reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-HAN-41309', 'Error on SetKeyValWithExpiry', error);
                                            //         } else {
                                            //             reqInstanceHelper.PrintInfo(serviceName, 'Cache added.', objLogInfo);
                                            //         }
                                            //     } catch (error) {
                                            //         reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-HAN-41310', 'Error on SetKeyValWithExpiry', error);
                                            //     }
                                            // });
                                        }
                                        afterQueryExecution(pError, pResult);
                                    } catch (error) {
                                        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-41311', 'Error on ExecuteSQLQuery', error);
                                    }
                                });
                            } catch (error) {
                                reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-41312', 'Error on executeQuery', error);
                            }
                        }

                        if (isCacheEnabled) {
                            var params = {
                                db: 'db1',
                                uniquKey: uniquRedisKey
                            };
                            reqCacheRedisInstance.GetCacheFromRedis(headers, params, objLogInfo, function (result) {
                                try {
                                    if (result) {
                                        afterQueryExecution(null, JSON.parse(result));
                                    } else {
                                        executeQuery();
                                    }
                                } catch (error) {
                                    reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-41313', 'Error on GetCacheFromRedis', error);
                                }
                            });
                            // reqCacheRedisInstance.GetKeyVal(redisDB, objLogInfo, uniquRedisKey, function (pError, pResult) {
                            //     try {
                            //         if (pError) {
                            //             executeQuery();
                            //         } else {
                            //             afterQueryExecution(pError, JSON.parse(pResult));
                            //         }
                            //     } catch (error) {
                            //         reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-41313', 'Error on GetKeyVal', error);
                            //     }
                            // });
                        } else {
                            executeQuery();
                        }
                    } else {
                        // Filter is not available prepare the blank select query
                        if (strORDER_BY != '') {
                            strQury = strQury + ' order by ' + strORDER_BY;
                        }
                        // uniquRedisKey = 'TRAN_CACHE~' + reqEncryptionInstance.EncryptPassword(strQury);
                        uniquRedisKey = 'TRAN_CACHE~' + strQury

                        function afterQueryWOCondExecution(pError, pResult) {
                            try {
                                if (pResult) {
                                    // console.log(pResult);
                                    RowCnt = pResult.rows.length;
                                    _PrintInfo('Table rows returned - ' + RowCnt)
                                    if (strDISPLAY_MEMBER != strVALUE_MEMBER) {
                                        for (var d = 0; d < pResult.rows.length; d++) {
                                            var obiRow = pResult.rows[d];
                                            obiRow.FX_KEY_COLUMN = '';
                                            arrRows.push(obiRow)
                                        }
                                    } else {
                                        strVM = strDISPLAY_MEMBER + '_1';
                                        for (var e = 0; e < pResult.rows.length; e++) {
                                            var obiRow = pResult.rows[e];
                                            obiRow.FX_KEY_COLUMN = '';
                                            obiRow[strVM] = obiRow[strDISPLAY_MEMBER.toLowerCase()];
                                            arrRows.push(obiRow)
                                        }
                                    }
                                    arrFields = pResult.fields;
                                    if (arrFields.length == 0 && pResult.rows.length > 0) {
                                        arrFields = Object.keys(pResult.rows[0]);
                                    }
                                    if (arrFields.length > 0) {
                                        for (var c = 0; c < arrFields.length; c++) {
                                            ClmnDetails = {}
                                            ClmnDetails.Name = arrFields[c].name;
                                            ClmnDetails.Header = arrFields[c].name;
                                            ClmnDetails.Width = 'Auto';
                                            ClmnDetails.Format = '';
                                            arrColumnDet.push(ClmnDetails);
                                        }
                                        if (arrColumnDet.length > 0) {
                                            _RelJsonForm();
                                        }
                                    } else {
                                        _RelJsonForm();
                                    }
                                } else if (pError) {
                                    reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-41303', 'Error in' + strQury + 'execution:', pError);
                                }
                            } catch (error) {
                                reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-41304', 'Error in _DpsTableContent-strQury execution:', error);
                            }
                        }

                        function executeQueryWOCond() {
                            try {
                                reqTranDBHelper.ExecuteSQLQuery(mTranDB, strQury, objLogInfo, function (pResult, pError) {
                                    try {
                                        // Handling If there is a DB Result as null;
                                        if (isCacheEnabled && pResult) {
                                            var params = {
                                                db: 'db1',
                                                uniquKey: uniquRedisKey,
                                                expirMin: cacheExpireMin,
                                                value: JSON.stringify(pResult)
                                            };

                                            reqCacheRedisInstance.AddCacheToRedis(headers, params, objLogInfo, function (result) {
                                                try {
                                                    if (result != 'SUCCESS') {
                                                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-HAN-41314', 'Error on AddCacheToRedis', result);
                                                    } else {
                                                        reqInstanceHelper.PrintInfo(serviceName, 'Cache added.', objLogInfo);
                                                    }
                                                } catch (error) {
                                                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-HAN-41315', 'Error on AddCacheToRedis', error);
                                                }
                                            });
                                            // reqCacheRedisInstance.SetKeyValWithExpiry(redisDB, objLogInfo, uniquRedisKey, JSON.stringify(pResult), cacheExpireMin, function (error, result) {
                                            //     try {
                                            //         if (error) {
                                            //             reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-HAN-41314', 'Error on SetKeyValWithExpiry', error);
                                            //         } else {
                                            //             reqInstanceHelper.PrintInfo(serviceName, 'Cache added.', objLogInfo);
                                            //         }
                                            //     } catch (error) {
                                            //         reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-HAN-41315', 'Error on SetKeyValWithExpiry', error);
                                            //     }
                                            // });
                                        }
                                        afterQueryWOCondExecution(pError, pResult);
                                    } catch (error) {
                                        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-41316', 'Error on ExecuteSQLQuery', error);
                                    }
                                });
                            } catch (error) {
                                reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-41317', 'Error on executeQueryWOCond', error);
                            }
                        }

                        if (isCacheEnabled) {
                            var params = {
                                db: 'db1',
                                uniquKey: uniquRedisKey
                            };
                            reqCacheRedisInstance.GetCacheFromRedis(headers, params, objLogInfo, function (result) {
                                try {
                                    if (result) {
                                        afterQueryWOCondExecution(null, JSON.parse(result));
                                    } else {
                                        executeQueryWOCond();
                                    }
                                } catch (error) {
                                    reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-41318', 'Error on GetCacheFromRedis', error);
                                }
                            });
                            // reqCacheRedisInstance.GetKeyVal(redisDB, objLogInfo, uniquRedisKey, function (pError, pResult) {
                            //     try {
                            //         if (pError) {
                            //             executeQueryWOCond();
                            //         } else {
                            //             afterQueryWOCondExecution(pError, JSON.parse(pResult));
                            //         }
                            //     } catch (error) {
                            //         reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-41318', 'Error on GetKeyVal', error);
                            //     }
                            // });
                        } else {
                            executeQueryWOCond();
                        }
                    }
                    //     } catch (error) {
                    //         reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-41319', 'Error on GetRedisConnection', error);
                    //     }
                    // });
                } catch (error) {
                    reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-41305', 'Error in _DpsTableContent function:', error);
                }
            }

            // For output json to send to client
            function _RelJsonForm() {
                try {
                    // if (arrColumnDet.length > 0) {
                    var arrRowsUpper = arrKeyToUpperCase(arrRows)
                    var RstRowContent = JSON.stringify(arrRowsUpper);
                    // console.log(RstRowContent)
                    strRowContent.RowContent = RstRowContent;
                    strRowContent.RowCount = RowCnt;
                    strRowContent.ColumnDetails = arrColumnDet;
                    strRowContent.NotVisibleColumnContent = NotVisibleColumnContent;
                    strRowContent.TemplateContent = TemplateContent;
                    strRowContent.TemplateBehaviour = TemplateBehaviour;
                    strRowContent.TemplateSaveParams = TemplateSaveParams;
                    strRowContent.RecordPerPage = RecordPerPage;
                    strRowContent.RecordDisplay = RecordDisplay;
                    strRowContent.PageDisplay = PageDisplay;
                    strRowContent.ChartTicks = ChartTicks;
                    strRowContent.Series = Series;
                    strRowContent.NeedCheckBox = NeedCheckBox;
                    strRowContent.DisplayMember = DisplayMember;
                    strRowContent.ValueMember = ValueMember;
                    strRowContent.BindingCode = BindingCode;
                    strRowContent.ListingMode = ListingMode;
                    strRowContent.LockingMode = LockingMode;
                    // console.log(strRowContent);
                    var RstData = JSON.stringify(strRowContent);
                    RstData = JSON.stringify(RstData);
                    reqInstanceHelper.SendResponse(serviceName, appResponse, strRowContent, objLogInfo, null, null, null);
                    // } else {
                    //     strRowContent.RowCount = '0';
                    //     reqInstanceHelper.SendResponse(serviceName, appResponse, strRowContent, objLogInfo, null, null, null);
                    // }
                } catch (error) {
                    reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-41306', 'Error in _RelJsonForm function:', error);
                }
            }

            // Convert an array keys to upper case
            function arrKeyToUpperCase(pArr) {
                try {
                    var arrForReturn = [];
                    for (var i = 0; i < pArr.length; i++) {
                        var obj = pArr[i];
                        var objNew = new Object();
                        for (var key in obj) {
                            var strUpperCaseKey = key.toUpperCase();
                            objNew[strUpperCaseKey] = obj[key];
                        }
                        arrForReturn.push(objNew);
                    }
                    return arrForReturn;
                } catch (error) {
                    reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-41307', 'Error in arrKeyToUpperCase function:', error);
                }
            }

            // Convert string to Date format
            function ToDate(pDate) {
                // var Restr = reqDateFormat(pDate, "yyyy-mm-dd hh:MM:ss")
                var Restr = reqDateFormatter.ConvertDate(pDate.toString(), headers);
                return Restr
            }
        })
    } catch (error) {
        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-41308', 'Error in DpsTable:', error);
    }

    // Print Log information
    function _PrintInfo(pMessage) {
        reqInstanceHelper.PrintInfo(serviceName, pMessage, objLogInfo)
    }
    // Print Log Error
    function _PrintErr(pError, pErrorCode, pMessage) {
        reqInstanceHelper.PrintError(serviceName, pError, pErrorCode, objLogInfo, pMessage)
    }
});

module.exports = router;
/****** End of Service *******/