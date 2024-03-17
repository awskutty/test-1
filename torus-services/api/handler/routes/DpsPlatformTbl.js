/*
@Api_Name           : /DpsPlatformTbl,
@Description        : To get the table data from Framework DB by finding the table details from DPS_PLATFOR_TABLE 
@Last_Error_code    : ERR-HAN-41205 
*/

// Require dependencies
var reqExpress = require('express');
var router = reqExpress.Router();
var reqLinq = require('node-linq').LINQ;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance')
var reqInsHelper = require('../../../../torus-references/common/InstanceHelper');
var strServiceName = 'DpsPlatformTbl'

// Host api to server
router.post('/DpsPlatformTbl', function(appRequest, appResponse, next) {
    var objLogInfo = ''
    try {
        reqLogInfo.AssignLogInfoDetail(appRequest, function(LogInfo, session_info) {
            // Handle the api close event from when client close the request
            appResponse.on('close', function() {});
            appResponse.on('finish', function() {});
            appResponse.on('end', function() {});

            objLogInfo = LogInfo
                // Initialize local variables
            // var strInputParamJson = strInputParamJson;
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
            var strSESSION_ID = appRequest.body.SESSION_ID;
            var strSTS_ID = session_info.STS_ID;
            var strSYSTEM_DESC = session_info.SYSTEM_DESC;
            var strSYSTEM_ID = session_info.SYSTEM_ID;
            var strS_ID = session_info.S_ID;
            var strTABLENAME = strInputParamJson.TABLENAME;
            var strTYPE = strInputParamJson.TYPE;
            var strUSER_ID = session_info.U_ID;
            var strUSER_NAME = session_info.USER_NAME;
            var strU_ID = session_info.U_ID;
            var strVALUE_MEMBER = strInputParamJson.VALUE_MEMBER;
            var strSelectedColumn = strInputParamJson.SELECTED_COLUMNS;
            var Condn = '';
            var ClusterCondn = '';
            var strOrm = 'knex';
            var arrColumnDet = [];
            var RowCnt = '0'
            var strRowContent = {};
            var NotVisibleColumnContent = '';
            var TemplateContent = '';
            var TemplateBehaviour = '';
            var TemplateSaveParams = '';
            var RecordPerPage = '0';
            var RecordDisplay = '';
            var PageDisplay = '';
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
            var arrFilterCond = [];
            var FilteredRow = [];
            objLogInfo.HANDLER_CODE = 'DPS_PLATFORM_TABLE';
            _PrintInfo('Begin');

            _DpsPlatformTableContent();

            // Query the table data from FX db
            function _DpsPlatformTableContent() {
                try {
                    var strMember = {}
                    if (strDISPLAY_MEMBER != strVALUE_MEMBER && strFIRST_RECORD_DISPLAY != '') {
                        strMember[strDISPLAY_MEMBER] = 'Select';
                        strMember[strVALUE_MEMBER] = 'null';
                        arrRows.push(strMember);
                    }

                    if (strDISPLAY_MEMBER == strVALUE_MEMBER) {
                        strMember[strDISPLAY_MEMBER] = 'Select';
                        strVM = strDISPLAY_MEMBER + '_1';
                        strMember[strVM] = 'null';
                        arrRows.push(strMember);
                    }


                    var strFill = JSON.parse(strFILTERS);
                    for (i = 0; i < strFill.length; i++) {
                        if (strFill[i].IS_CLUSTER_KEY == 'Y') {
                            if (strFill[i].OPRTR == 'IN' && strFill[i].SOURCE_VALUE) {
                                if (ClusterCondn != '')
                                    ClusterCondn += ' AND ' + strFill[i].SOURCE_NAME + strFill[i].OPRTR + '\'' + strFill[i].SOURCE_VALUE + '\'';
                                else
                                    ClusterCondn = strFill[i].SOURCE_NAME + strFill[i].OPRTR + '\'' + strFill[i].SOURCE_VALUE + '\'';
                            } else if (strFill[i].SOURCE_VALUE && (strFill[i].OPRTR == '<' || strFill[i].OPRTR == '<=' || strFill[i].OPRTR == '>' || strFill[i].OPRTR == '>=')) {
                                var strBindVal = (strFill[i].DATA_TYPE == 'NUMBER') ? strFill[i].SOURCE_VALUE : "'" + strFill[i].SOURCE_VALUE + "'";
                                if (ClusterCondn != '')
                                    ClusterCondn += ' AND TOKEN(' + strFill[i].SOURCE_NAME + ') ' + strFill[i].OPRTR + ' TOKEN(' + strBindVal + ')';
                                else
                                    ClusterCondn = ' TOKEN(' + strFill[i].SOURCE_NAME + ') ' + strFill[i].OPRTR + ' TOKEN(' + strBindVal + ')';
                            } else {
                                var strBindVal = (strFill[i].DATA_TYPE == 'NUMBER') ? strFill[i].SOURCE_VALUE : "'" + strFill[i].SOURCE_VALUE + "'";
                                if (ClusterCondn != '')
                                    ClusterCondn += ' AND ' + strFill[i].SOURCE_NAME + strFill[i].OPRTR + strBindVal;
                                else
                                    ClusterCondn = strFill[i].SOURCE_NAME + strFill[i].OPRTR + strBindVal;
                            }
                        } else if (strFill[i].IS_CLUSTER_KEY == 'N') {
                            if (strFill[i].SOURCE_NAME != '' && strFill[i].SOURCE_VALUE != '') {
                                var objFilterCond = {}
                                objFilterCond.col = strFill[i].SOURCE_NAME.toLowerCase();
                                objFilterCond.val = strFill[i].SOURCE_VALUE;
                                objFilterCond.oprtr = strFill[i].OPRTR;
                                arrFilterCond.push(objFilterCond);
                            } else if (strFill[i].OPRTR == "=") {
                                if (strFill[i].BINDING_VALUE != '') {
                                    if (ClusterCondn != '') {
                                        ClusterCondn += 'AND ' + strFill[i].BINDING_NAME + '=\'' + strFill[i].BINDING_VALUE + '\'';
                                    } else {
                                        ClusterCondn = strFill[i].BINDING_NAME + '=\'' + strFill[i].BINDING_VALUE + '\'';
                                    }
                                }

                            }

                        } //Modified by udhayaraj Ms for filter combo
                        else if (strFill[i].OPRTR == "=" || strFill[i].OPRTR == ">=" || strFill[i].OPRTR == ">" || strFill[i].OPRTR == "<=" || strFill[i].OPRTR == "<") {
                            // >, >=, <, <=, = Operator
                            if (strFill[i].BINDING_VALUE != '') {
                                var strBindVal = (strFill[i].DATA_TYPE == 'NUMBER') ? strFill[i].BINDING_VALUE : "'" + strFill[i].BINDING_VALUE + "'";
                                if (ClusterCondn != '') {
                                    ClusterCondn += ' AND ' + strFill[i].BINDING_NAME + strFill[i].OPRTR + strBindVal;
                                } else {
                                    ClusterCondn = strFill[i].BINDING_NAME + strFill[i].OPRTR + strBindVal;
                                }
                            }

                            //UdhayaRajMs added CONTAINS filter
                        } else if (strFill[i].OPRTR == 'STARTS' || strFill[i].OPRTR == 'CONTAINS') {
                            _PrintInfo('Enter into  "STARTS"   Operator, prepare like query.');
                            var objFilterCond = {}
                            objFilterCond.col = strFill[i].BINDING_NAME;
                            objFilterCond.val = strFill[i].BINDING_VALUE;
                            objFilterCond.oprtr = strFill[i].OPRTR;
                            arrFilterCond.push(objFilterCond);
                        }
                    }
                    if (strTABLENAME) {
                        if (strTABLENAME != '') {
                            var strQury = 'Select * from PLATFORM_TABLES' + ' where table_name =?' + ' allow filtering';
                            _GetKeyspace(strQury)
                        }
                    }
                } catch (error) {
                    reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-41401', "Error in _DpsPlatformTableContent function - ", error);
                }
            }

            // Get the table keyspace information from PLATFORM_TABLES
            function _GetKeyspace(strQury) {
                try {
                    _PrintInfo('Executing FX DB query : ' + strQury);
                    reqFXDBInstance.GetFXDBConnection(appRequest.headers, 'clt_cas', objLogInfo, function CallbackGetCassandraConn(mClient) {
                        var strkeyspaceType = '';
                        reqFXDBInstance.GetTableFromFXDB(mClient, 'PLATFORM_TABLES', [], {
                            table_name: strTABLENAME
                        }, objLogInfo, function callbackSelA(pError, pResult) {
                            if (pError) {
                                reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-41402', "Error in PLATFORM_TABLES Execution - ", pError);
                            } else if (pResult) {
                                try {
                                    _PrintInfo('FX DB query Result Count : ' + pResult.rows.length);
                                    strkeyspaceType = pResult.rows[0].keyspace_type;
                                    var strFields = pResult.rows[0].columns;
                                    _PrepareTableData(strFields, strkeyspaceType);
                                } catch (error) {
                                    reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-41403', "Error in _GetKeyspace  - _PrepareTableData", error);
                                }
                            }
                        });
                    });
                } catch (error) {
                    reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-41404', "Error in _GetKeyspace function - ", error);
                }
            }

            // Get the found keyspace connection and query the given table
            function _PrepareTableData(pFields, pkeyspaceType) {
                try {
                    reqFXDBInstance.GetFXDBConnection(appRequest.headers, pkeyspaceType, objLogInfo, function CallbackGetCassandraConn(mNewClient) {
                        var strTableQry = '';
                        var strtabCondn = '';

                        if (strSelectedColumn != '' && strSelectedColumn != undefined) {
                            var splitSelectedColumn = strSelectedColumn.split(',')

                            // To remove strDISPLAY_MEMBER column from selected column if 
                            for (var m = 0; m < splitSelectedColumn.length; m++) {
                                var dmIndex = strDISPLAY_MEMBER.indexOf(splitSelectedColumn[m]);
                                if (dmIndex > -1) {
                                    splitSelectedColumn.splice(dmIndex, 1);
                                    break;
                                }
                            }

                            // to remove strVALUE_MEMBER column from selected column if 
                            for (var n = 0; m < splitSelectedColumn.length; n++) {
                                var vmIndex = strVALUE_MEMBER.indexOf(splitSelectedColumn[m]);
                                if (vmIndex > -1) {
                                    splitSelectedColumn.splice(vmIndex, 1);
                                    break;
                                }
                            }
                            if (strSelectedColumn != '' && ClusterCondn != '') {
                                strTableQry = 'select ' + strSelectedColumn.toLowerCase() + "," + strDISPLAY_MEMBER + "," + strVALUE_MEMBER + ' from ' + strTABLENAME.toLowerCase() + ' where ' + ClusterCondn.toLowerCase() + " allow filtering";
                            } else {
                                strTableQry = 'select ' + strSelectedColumn.toLowerCase() + "," + strDISPLAY_MEMBER + "," + strVALUE_MEMBER + ' from ' + strTABLENAME.toLowerCase();
                            }
                        } else {
                            if (ClusterCondn != '') {
                                strTableQry = 'select  *  from ' + strTABLENAME.toLowerCase() + ' where ' + ClusterCondn.toLowerCase() + ' allow filtering';
                            } else {
                                strTableQry = 'select * from ' + strTABLENAME.toLowerCase();
                            }
                        }

                        _PrintInfo('Executing FX DB query : ' + strTableQry);
                        reqFXDBInstance.ExecuteQuery(mNewClient, strTableQry, objLogInfo, function callbackSelA(pError, pResult) {
                            if (pError) {
                                reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-41405', 'Error in' + strTableQry + 'Execution', pError);

                            } else if (pResult) {
                                try {
                                    if (pResult.rows) {
                                        _PrintInfo('FX DB query Result Count : ' + pResult.rows.length);
                                        if (pResult.columns != undefined) {
                                            _PrintInfo('columns available');
                                            for (j = 0; j < pResult.columns.length; j++) {
                                                arrFields.push(pResult.columns[j].name)
                                            }
                                        } else if (pResult.fields.length > 0) {
                                            _PrintInfo('Fileds available');
                                            for (j = 0; j < pResult.fields.length; j++) {
                                                arrFields.push(pResult.fields[j].name)
                                            }
                                        }
                                        //var arrRamRows = pResult.rows;
                                        if (arrFilterCond.length > 0) {
                                            FilteredRow = new reqLinq(pResult.rows)
                                                .Where(function(item) {
                                                    var isSatisfied = false;
                                                    for (var i = 0; i < arrFilterCond.length; i++) {
                                                        var filter = arrFilterCond[i];
                                                        if ((item[filter.col.toLowerCase()]) == null) {
                                                            (item[filter.col.toLowerCase()]) = '';
                                                        }
                                                        if (filter.oprtr == '=') {
                                                            if (item[filter.col] == filter.val) {
                                                                isSatisfied = true;
                                                            } else {
                                                                isSatisfied = false;
                                                                break;
                                                            }
                                                        } else if (filter.oprtr == 'NOT IN') {
                                                            if (item[filter.col] != filter.val) {
                                                                isSatisfied = true;
                                                            } else {
                                                                isSatisfied = false;
                                                                break;
                                                            }
                                                        } else if (filter.oprtr == '<>') {
                                                            if (item[filter.col] != filter.val) {
                                                                isSatisfied = true;
                                                            } else {
                                                                isSatisfied = false;
                                                                break;
                                                            }
                                                        } else if (filter.oprtr == 'STARTS') {
                                                            isSatisfied = item[filter.col.toLowerCase()].toUpperCase().startsWith(arrFilterCond[i].val.toUpperCase())
                                                            break;
                                                        } else if (filter.oprtr == 'CONTAINS') {
                                                            // return item[filter.col.toLowerCase()].toUpperCase().Contains(arrFilterCond[i].val.toUpperCase())
                                                            var searchitem = item[filter.col.toLowerCase()].toUpperCase();
                                                            var searchkey = arrFilterCond[i].val.toUpperCase();
                                                            var n = searchitem.indexOf(searchkey);
                                                            if (n <= -1) {
                                                                isSatisfied = false;
                                                                break;
                                                            } else {
                                                                isSatisfied = true;
                                                                break;
                                                            }
                                                        }
                                                    }
                                                    return isSatisfied;
                                                }).ToArray();
                                        } else {
                                            _PrintInfo('Filter not applied.');
                                            FilteredRow = pResult.rows;
                                        }
                                    }

                                    if (strDISPLAY_MEMBER != strVALUE_MEMBER) {
                                        for (i = 0; i < FilteredRow.length; i++) {
                                            var obiRow = FilteredRow[i];
                                            obiRow.FX_KEY_COLUMN = '';
                                            arrRows.push(obiRow)
                                        }
                                    } else {
                                        for (i = 0; i < FilteredRow.length; i++) {
                                            var obiRow = FilteredRow[i];
                                            obiRow.FX_KEY_COLUMN = '';
                                            obiRow[strVM] = obiRow[strDISPLAY_MEMBER.toLowerCase()];
                                            arrRows.push(obiRow)
                                        }
                                    }
                                    RowCnt = FilteredRow.length;
                                    _PrintInfo('Final result rows count : ' + RowCnt);
                                    _PrepareRowContent();

                                } catch (error) {
                                    reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-41406', 'Error in strTableQry', error);
                                }
                            }
                        });
                    });
                } catch (error) {
                    reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-41407', 'Error in _PrepareTableData function', error);
                }
            }

            // Prepare result json object to send to client 
            function _PrepareRowContent() {
                try {

                    if (arrFields.length > 0) {
                        for (j = 0; j < arrFields.length; j++) {
                            var ClmnDetails = {}
                            ClmnDetails.Name = arrFields[j];
                            ClmnDetails.Header = arrFields[j];
                            ClmnDetails.Width = 'Auto';
                            ClmnDetails.Format = '';
                            arrColumnDet.push(ClmnDetails);
                        }
                        if (arrColumnDet.length > 0) {
                            _RelJsonForm();
                        }
                    }
                } catch (error) {
                    reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-41408', 'Error in _PrepareRowContent function', error);
                }
            }

            // For the result relation json
            function _RelJsonForm() {
                try {

                    if (arrColumnDet.length > 0) {
                        var arrRowsUpper = arrKeyToUpperCase(arrRows)
                        var RstRowContent = JSON.stringify(arrRowsUpper)
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
                        var RstData = JSON.stringify(strRowContent);
                        RstData = JSON.stringify(RstData);
                        _PrintInfo('Result json prepared successfully');
                        reqInsHelper.SendResponse(strServiceName, appResponse, strRowContent, objLogInfo, '', "", "");
                    }
                } catch (error) {
                    reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-41409', 'Error in _RelJsonForm function', error);
                }
            }

            // Convert a hashtable keys to uppercase
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
                    reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-41410', 'Error in arrKeyToUpperCase function', error);
                }
            }
        })
    } catch (error) {
        reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-41411', 'Error in DpsPlatformTbl', error);
    }

    // Print Log information
    function _PrintInfo(pMessage) {
        reqInsHelper.PrintInfo(strServiceName, pMessage, objLogInfo)
    }
    // Print Log Error
    function _PrintErr(pError, pErrorCode, pMessage) {
        reqInsHelper.PrintError(strServiceName, pError, pErrorCode, objLogInfo, pMessage)
    }
});

module.exports = router;
/****** End of Service *******/