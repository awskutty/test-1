/**
 * @author      : Shanthi
 * @Description : Deploy report on JasperServer
 * @Date        : 14/Oct/2016
 * 
 */
var modPath = '../../../../node_modules/';
var refHelperPath = '../../../../torus-references/helper/';
var reqSoap = require('../' + modPath + 'soap');
var reqFs = require('fs');
var xml2js = require('xml2js');
var parser = new xml2js.Parser()
var path = require('../' + modPath + 'path');
var reqAsync = require('../' + modPath + 'async');
var reqDom = require('../' + modPath + 'xmldom').DOMParser;
var reqInstanceHelper = require('../../../../../torus-references/common/InstanceHelper')

// Global variable declaration
var mJSUrl = 'http://{USERNAME}:{PASSWORD}@{SERVER}:{PORT}/jasperserver/services/repository?wsdl'
var mServer = ''
var mPort = ''
var mUsername = ''
var mPassword = ''
var mSessionVariable = []
var mSoapClient = null
var mFolderExist = false
var mDataSourceName = ''
var mFolderName = ''

// Initialize JasperServer Webservice
function _InitializeJasperServer(pCallback) {
    try {
        mDataSourceName = ''
        mFolderExist = false

        if (mSoapClient == null) {
            mJSUrl = mJSUrl.replaceAll('{SERVER}', mServer);
            mJSUrl = mJSUrl.replaceAll('{PORT}', mPort);
            mJSUrl = mJSUrl.replaceAll('{USERNAME}', mUsername);
            mJSUrl = mJSUrl.replaceAll('{PASSWORD}', mPassword);

            _PrintInfo('JasperServer URL ' + mJSUrl, null)
            reqSoap.createClient(mJSUrl, function (err, client) {
                if (client != null && client != undefined) {
                    client.setSecurity(new reqSoap.BasicAuthSecurity(mUsername, mPassword));
                    mSoapClient = client
                    _PrintInfo('JasperServer initialized successfully ', null)
                    // Create folder if 'Myreports' folder is not exist on JasperServer
                    if (!mFolderExist) {
                        var strFolder = 'Myreports'
                        _IsExistResource(strFolder, '/reports/' + strFolder, 'folder', '', function callbackIsExistResource(pStatus) {
                            if (pStatus) {
                                mFolderExist = true
                                _PrintInfo('Myreports folder already exist', null)
                                pCallback()
                            } else {
                                _CreateFolder(strFolder, function callbackCreateFolder(err, Result) {
                                    _PrintInfo('Myreports folder created successfully', null)
                                    mFolderExist = true
                                    pCallback()
                                })
                            }
                        })
                    }
                } else {
                    _PrintError('The Jasperserver is not connected with following info ' + mJSUrl, '')
                    pCallback()
                }
            })
        } else {
            _PrintInfo('JasperServer initialized successfully ', null)
            pCallback()
        }
    } catch (ex) {
        _PrintError('Error on _InitializeJasperServer()' + ex, '')
    }
}

//Myreports Folder Creation
function _CreateFolder(pFolderName, pCallback) {
    try {
        var createXML = " <!--Myreports Folder Creation--> <request operationName='put' locale='en'> " +
            " <resourceDescriptor name='{FOLDER_NAME}' wsType='folder' uriString='/reports/{FOLDER_NAME}' isNew='true'> " +
            " <label><![CDATA[{FOLDER_NAME}]]></label> <description><![CDATA[{FOLDER_NAME}]]></description> " +
            " <resourceProperty name='PROP_PARENT_FOLDER'> <value><![CDATA[/reports]]></value> </resourceProperty> " +
            " </resourceDescriptor></request>"
        var requestXMLstr = createXML.replaceAll("{FOLDER_NAME}", pFolderName)
        _CallJSWebservice("PUT", requestXMLstr, function callbackCallWebService() {
            pCallback()
        })
    } catch (ex) {
        _PrintError('Error on _CreateFolder()' + ex, '')
    }
}

// Check if exist the resource like folder, report etc in JasperServer
function _IsExistResource(pResourceName, pResourceUri, pResourceType, pSubReportName, pCallback) {
    try {
        var createXML = "<request operationName='get'> <resourceDescriptor name='{RESOURCE_NAME}' wsType='{RESOURCE_TYPE}' uriString='{RESOURCE_URI}' isNew='false'> </resourceDescriptor> </request>"
        var RequestXML = createXML.replace("{RESOURCE_NAME}", pResourceName)
        RequestXML = RequestXML.replace("{RESOURCE_URI}", pResourceUri)
        RequestXML = RequestXML.replace("{RESOURCE_TYPE}", pResourceType)
        _CallJSWebservice("GET", RequestXML, function callbackCallJSWebservice(pResult) {
            var ResultStr = pResult


            var blnStatus = false
            if (ResultStr != undefined && ResultStr != null) {
                if (ResultStr['getReturn'] != null && ResultStr['getReturn'] != undefined) {
                    // find in result string
                    parser.parseString(ResultStr['getReturn'].$value, function (err, result) {

                        var propnodes = result['operationResult']['resourceDescriptor'];
                        if (pSubReportName != '') {
                            // Find on Subresource
                            pResourceName = pSubReportName
                            if (propnodes != undefined && propnodes != null) {
                                for (var i = 0; i < propnodes.length; i++) {
                                    var xmlnod = propnodes[i]
                                    for (var j = 0; j < xmlnod['resourceDescriptor'].length; j++) {
                                        var subResource = xmlnod['resourceDescriptor'][j]
                                        if (subResource["label"] != undefined && subResource["label"] != null && subResource["label"][0].toUpperCase() == pResourceName.toUpperCase()) {
                                            blnStatus = true
                                            break;
                                        }
                                    }
                                }
                            }
                        } else {
                            // Find on mainresource
                            if (propnodes != undefined && propnodes != null) {
                                for (var i = 0; i < propnodes.length; i++) {
                                    var xmlnod = propnodes[i]
                                    if (xmlnod["label"][0] == pResourceName) {
                                        blnStatus = true
                                        break;
                                    }
                                }
                            }
                        }
                        return pCallback(blnStatus)
                    })
                } else
                    return pCallback(blnStatus)
            } else
                return pCallback(blnStatus)

        })
    } catch (ex) {
        _PrintError('Error on _IsExistResource()' + ex, '')
    }
}

// Publish new report
function PublishNewReport(pMainRptName, pMainRptDesc, pMainRptJrxml, pSubRptDetail, pTranDB, pCallback) {
    try {
        var rptName = pMainRptName
        if (pMainRptJrxml != '') {
            mSessionVariable = _GetSessionVariableList()

            _ChangeMainReportJrxml(pMainRptJrxml, pSubRptDetail, function callbackChangeMainReportJrxml(pJrxml) {
                pMainRptJrxml = pJrxml

                GetDataSourceName(pTranDB, function callback(pDataSourceName) {

                    pMainRptJrxml = _ChangeDataSourceName(pMainRptJrxml, pDataSourceName)

                    // Write into file the MainReport jrxml 
                    var srcFileName = path.join(mFolderName, pMainRptName + ".jrxml")
                    reqFs.writeFile(srcFileName, pMainRptJrxml, function (err) {

                        // Publish Main report
                        AddMainReport(pMainRptName, pMainRptDesc, pDataSourceName, function callbackMainReport() {

                            if (mSessionVariable.indexOf("WhereCond") < 0)
                                mSessionVariable.push("WhereCond")

                            // Add Input control
                            AddInputControl(mSessionVariable, 0, rptName, function callback() {

                                // Add subreport
                                // AddSubReport(function callbackAddSubReport() {
                                pCallback()
                                // })
                            })

                        })
                    })
                })
            })
        } else {
            _PrintError('Error : Invalid Jrxml for the following report as ' + pMainRptName, '')
            pCallback('Success')
        }
    } catch (ex) {
        _PrintError('Error on PublishNewReport()' + ex, '')
    }
}

function AddInputControl(pLstInputControl, pIndex, pRptName, pCallback) {
    try {
        var strInputControlName = pLstInputControl[pIndex]

        var createXML = "<request operationName='put' locale='en'> <argument name='MODIFY_REPORTUNIT_URI'>/reports/Myreports/{MAINREPORT_NAME}</argument> <!--input control--> <resourceDescriptor name='{INPUTCONTROL_NAME}' wsType='inputControl' uriString='/reports/Myreports/{MAINREPORT_NAME}/{INPUTCONTROL_NAME}' isNew='true'> <label><![CDATA[{INPUTCONTROL_NAME}]]></label> <description><![CDATA[{INPUTCONTROL_NAME}]]></description> <resourceProperty name='PROP_RESOURCE_TYPE'> <value><![CDATA[com.jaspersoft.jasperserver.api.metadata.common.domain.InputControl]]></value> </resourceProperty> <resourceProperty name='PROP_INPUTCONTROL_IS_MANDATORY'> <value><![CDATA[false]]></value> </resourceProperty> <resourceProperty name='PROP_INPUTCONTROL_IS_READONLY'> <value><![CDATA[false]]></value> </resourceProperty> <resourceProperty name='PROP_INPUTCONTROL_IS_VISIBLE'> <value><![CDATA[false]]></value> </resourceProperty> <resourceProperty name='PROP_INPUTCONTROL_TYPE'> <value><![CDATA[2]]></value> </resourceProperty> <resourceDescriptor name='DT_{INPUTCONTROL_NAME}' wsType='dataType' isNew='true'> <label><![CDATA[DT_{INPUTCONTROL_NAME}]]></label> <description><![CDATA[{INPUTCONTROL_NAME}]]></description> <resourceProperty name='PROP_RESOURCE_TYPE'> <value><![CDATA[com.jaspersoft.jasperserver.api.metadata.common.domain.DataType]]></value> </resourceProperty> <resourceProperty name='PROP_DATATYPE_TYPE'> <value><![CDATA[1]]></value> </resourceProperty> </resourceDescriptor> </resourceDescriptor> </request>"

        var RequestXML = createXML.replaceAll("{MAINREPORT_NAME}", pRptName)
        RequestXML = createXML.replaceAll("{INPUTCONTROL_NAME}", strInputControlName)
        _CallJSWebservice("PUT", RequestXML, function callback() {
            pIndex = pIndex + 1
            if (pLstInputControl.length == pIndex)
                pCallback()
            else
                AddInputControl(pLstInputControl, pIndex, pRptName, pCallback)
        })
    } catch (ex) {
        _PrintError('Error on AddInputControl()' + ex, '')
    }
}

function AddMainReport(pMainReportName, pMainRptDesc, pDataSourceName, pCallback) {
    try {
        RUNJAR(path.join(__dirname, "PublishReport.jar"), 'MAIN', 'ADD', pMainReportName, pMainRptDesc, '', pDataSourceName, function (pStatus) {
            return pCallback('SUCCESS')
        })
    } catch (ex) {
        _PrintError('Error on AddMainReport()' + ex, '')
    }
}

function AddSubReport1(pMainRptName, pMainRptDesc, pSubRptDetail, pCallback) {
    // subreport
    var subreportName = []
    reqAsync.forEach(pSubRptDetail.Keys, function (key, callbackser) {
        var subreport = key

        var SubRptPath = path.join(mFolderName, subreport + ".jrxml")
        reqFs.writeFile(SubRptPath, pSubRptDetail[subreport], function (err) {
            subreportName.push(subreport)
            callbackser()
        }, function (err, result) {
            // Add subreport
            if (subreportName.length > 0)
                RUNJAR(path.join(__dirname, "PublishReport.jar"), 'SUB', 'ADD', pMainRptName, pMainRptDesc, subreportName.join(), '', function (pStatus) {
                    pCallback('SUCCESS')
                })
            else
                pCallback('SUCCESS')
        })
    })
}

// run jar file to publish report
function RUNJAR(pCommand, pReportType, pReportProcess, pMainReportName, pMainRptDesc, pSubreportNameList, pDataSourceName, pCallback) { //, jarpcallback) {
    try {
        var child = require('child_process').spawn(
            'java', ['-jar', pCommand, mServer, mPort, mUsername, mPassword, pReportType, pReportProcess, pMainReportName, pMainRptDesc, pSubreportNameList, pDataSourceName])
        child.stdout.on('data', function (data) {
            _PrintInfo('Jar file Execution - ' + data.toString(), null);
            console.log("SUCCESS" + data.toString());
        });

        child.stderr.on("data", function (data) {
            console.log("ERROR" + data.toString());
        });
        child.on('close', function (code) {
            _PrintInfo('Jar file Execution - process exit code ' + code, null);
            pCallback('success')
        });
    } catch (ex) {
        _PrintError('Error on RUNJAR()' + ex, '')
    }
}

function _GetSessionVariableList() {
    try {
        var arrSessionVariable = [];
        arrSessionVariable.push('APPU_ID')
        arrSessionVariable.push('APPR_ID')
        arrSessionVariable.push('STS_ID')
        arrSessionVariable.push('UID')
        arrSessionVariable.push('APP_NAME')
        arrSessionVariable.push('LOGIN_NAME')
        arrSessionVariable.push('SYSTEM_ID')
        arrSessionVariable.push('SYSTEM_NAME')
        arrSessionVariable.push('CLIENT_ID')
        arrSessionVariable.push('CLUSTER_CODE')
        arrSessionVariable.push('CHILD_STS_ID')
        arrSessionVariable.push('APP_ID')
        arrSessionVariable.push('TOKENID')
        arrSessionVariable.push('SP1')
        arrSessionVariable.push('SP2')
        arrSessionVariable.push('SP3')
        arrSessionVariable.push('SP4')
        arrSessionVariable.push('SP5')
        arrSessionVariable.push('SP6')
        arrSessionVariable.push('SP7')
        arrSessionVariable.push('SP8')
        arrSessionVariable.push('SP9')
        arrSessionVariable.push('SP10')
        arrSessionVariable.push('SP11')
        arrSessionVariable.push('SP12')
        arrSessionVariable.push('SP13')
        arrSessionVariable.push('SP14')
        arrSessionVariable.push('SP15')
        arrSessionVariable.push('SP16')
        arrSessionVariable.push('SP17')
        arrSessionVariable.push('SP18')
        arrSessionVariable.push('SP19')
        arrSessionVariable.push('SP20')

        return arrSessionVariable
    } catch (ex) {
        _PrintError('Error on _GetSessionVariableList()' + ex, '')
    }
}

// Call jasperServer webservice
function _CallJSWebservice(pType, pRequestXML, pCallback) {
    var blnCompleted = false
    var ResultStr = ""
    var count = 0

    try {
        if (pType.toUpperCase() == "PUT")
            mSoapClient.put({
                putRequest: pRequestXML
            }, function callback(err, pResultStr) {
                if (err)
                    _PrintError(err, '')
                blnCompleted = true
                ResultStr = pResultStr
                return pCallback(ResultStr)
            })
        else if (pType.toUpperCase() == "DELETE")
            mSoapClient.delete({
                deleteRequest: pRequestXML
            }, function callback(pResultStr) {
                blnCompleted = true
                ResultStr = pResultStr
                return pCallback(ResultStr)
            })
        else if (pType.toUpperCase() == "GET")
            mSoapClient.get({
                getRequest: pRequestXML
            }, function callback(err, pResultStr) {
                if (err)
                    _PrintError(err, '')
                blnCompleted = true
                ResultStr = pResultStr
                return pCallback(ResultStr)
            })
    } catch (ex) {
        _PrintError('Error on _CallJSWebservice()' + ex.toString(), '')
        return pCallback(ResultStr)
    }
}

// Check if Report already exist or not
function IsReportExist(pMainRptName, pSubreportName, pCallback) {
    try {
        _IsExistResource(pMainRptName, "/reports/Myreports/" + pMainRptName, "reportUnit", pSubreportName, function callbackExistResource(pStatus) {
            return pCallback(pStatus)
        })
    } catch (ex) {
        _PrintError('Error on IsReportExist()' + ex, '')
    }
}

// Change mainReport Jrxml if Subreport exist
function _ChangeMainReportJrxml(pMainReportJrxml, pArrSubreport, pCallback) {
    try {
        var MainReportJrxml = pMainReportJrxml

        var doc = new reqDom().parseFromString(MainReportJrxml)
        var propnodes = doc.getElementsByTagName('subreportExpression')

        if (propnodes != undefined && propnodes != null) {
            for (var k = 0; k < pArrSubreport.length; k++) {
                var subRpt = pArrSubreport[k]
                for (var i = 0; i < propnodes.length; i++) {
                    var xmlnod = propnodes[i]
                    if (xmlnod.childNodes[0].nodeValue.toString().toUpperCase().indexOf((Object.keys(subRpt)[0] + '.jasper').toUpperCase()) >= 0) {
                        xmlnod.childNodes[0].nodeValue = '"repo:' + Object.keys(subRpt)[0] + '.jrxml"'
                        xmlnod.childNodes[0].data = '"repo:' + Object.keys(subRpt)[0] + '.jrxml"'
                    }
                }
            }
            MainReportJrxml = doc.toString()
        }
        return pCallback(MainReportJrxml)
    } catch (ex) {
        _PrintError('Error on _ChangeMainReportJrxml()' + ex, '')
    }
}

// Delete Mainreport in Jasperserver
function DeleteMainReport(pMainRptName, pCallback) {

    try {
        _PrintInfo('Deleting main report ' + pMainRptName + '...', null)

        var createXML = "  <request operationName='delete' locale='en'> " +
            "   <resourceDescriptor name='{MAINREPORT_NAME}' wsType='reportUnit' uriString='/reports/Myreports/{MAINREPORT_NAME}' isNew='false'>" +
            "   <label>{MAINREPORT_NAME}</label> " +
            "   </resourceDescriptor> " +
            "   </request> "
        var requestXML = createXML.replaceAll("{MAINREPORT_NAME}", pMainRptName)
        _CallJSWebservice("DELETE", requestXML, function callbackCallJSWebservice() {
            _PrintInfo('Deleted main report successfully ' + pMainRptName, null)
            pCallback('Success')
        })
    } catch (ex) {
        _PrintError('Error on DeleteMainReport()' + ex, '')
    }
}

// Delete Subreport from MainReport in Jasperserver
function DeleteSubReport(pMainRptName, pSubreportName, pCallback) {
    try {
        _PrintInfo('Deleted sub report ' + pSubreportName + '  successfully from ' + pMainRptName, null)

        var createXML = "<!--delete subreport jrxml--> <request operationName='delete' locale='en'> <argument name='MODIFY_REPORTUNIT_URI'>/reports/Myreports/{MAINREPORT_NAME}</argument> <resourceDescriptor name='{SUBREPORT_NAME}.jrxml' wsType='jrxml' " +
            " uriString='/reports/Myreports/{MAINREPORT_NAME}_files/{SUBREPORT_NAME}.jrxml' isNew='false'> <label><![CDATA[{SUBREPORT_NAME}.jrxml]]></label>  <resourceProperty name='PROP_RU_IS_MAIN_REPORT'> <value><![CDATA[false]]></value> </resourceProperty> </resourceDescriptor> </request>"

        var requestXML = createXML.replaceAll("{MAINREPORT_NAME}", pMainRptName)
        requestXML = requestXML.replaceAll("{SUBREPORT_NAME}", pSubreportName)

        _CallJSWebservice("DELETE", requestXML, function callbackCallJSWebservice() {
            pCallback('Success')
        })
    } catch (ex) {
        _PrintError('Error on DeleteSubReport()' + ex, '')
    }
}

// Change datasourcename in jrxml
function _ChangeDataSourceName(pJrxml, pDataSourceName) {

    var MainReportJrxml = pJrxml
    var doc = new reqDom().parseFromString(MainReportJrxml)
    var propnodes = doc.getElementsByTagName('property')
    // Get datasource property 
    if (propnodes != undefined && propnodes != null) {
        for (var i = 0; i < propnodes.length; i++) {
            var xmlnod = propnodes[i]
            if (xmlnod.attributes[0].value == 'com.jaspersoft.studio.data.defaultdataadapter') {
                xmlnod.attributes[1].value = pDataSourceName
                //  xmlnod.attributes[1].data = pDataSourceName
            }
        }
    }
    return doc.toString()
}


// get datasourcename (database adapter name) 
function GetDataSourceName(pTranDB, pCallback) {
    try {
        if (mDataSourceName != '') {
            pCallback(mDataSourceName)
        } else {
            var IPAddr = ""
            var Port = ""
            var DBName = ""
            var Username = ""
            var Password = ""
            var ConnectionUrl = ''
            var DBType = ''
            var DBDriver = ''

            var TranDB = GetTranDBDetail(pTranDB)

            var s = TranDB.split(";")

            IPAddr = s[0]
            Port = s[1]
            DBName = s[2]
            Username = s[3]
            Password = s[4]
            ConnectionUrl = s[5]
            DBType = s[6]
            DBDriver = s[7]

            var str = IPAddr.split(".")
            var datasourceName = "{2}_Server_{0}_{1}".replace('{0}', str[3])
            datasourceName = datasourceName.replace('{1}', DBName)
            datasourceName = datasourceName.replace('{2}', DBType)

            _IsExistResource(datasourceName, "/datasources/" + datasourceName, "dataSource", "", function callback(pStatus) {
                if (pStatus) {
                    _PrintInfo('Current DataSource name in Jasperserver as ' + datasourceName, null)
                    mDataSourceName = datasourceName
                    return pCallback(datasourceName)
                } else {
                    var createXML = "<!--DataSource Creation--> <request operationName='put' locale='en'> <resourceDescriptor name='{DATASOURCE_NAME}' wsType='jdbc' uriString='/datasources/{DATASOURCE_NAME}' isNew='true'> <label><![CDATA[{DATASOURCE_NAME}]]></label> <description><![CDATA[{DATASOURCE_DESC}]]></description> <resourceProperty name='PROP_RESOURCE_TYPE'> <value><![CDATA[com.jaspersoft.jasperserver.api.metadata.jasperreports.domain.JdbcReportDataSource]]></value> </resourceProperty> <resourceProperty name='PROP_PARENT_FOLDER'> <value><![CDATA[/datasources]]></value> </resourceProperty> <resourceProperty name='PROP_DATASOURCE_DRIVER_CLASS'> <value><![CDATA[{DBDRIVER}]]></value> </resourceProperty> <resourceProperty name='PROP_DATASOURCE_PASSWORD'> <value><![CDATA[{PASSWORD}]]></value> </resourceProperty> <resourceProperty name='PROP_DATASOURCE_USERNAME'> <value><![CDATA[{USERNAME}]]></value> </resourceProperty> <resourceProperty name='PROP_DATASOURCE_CONNECTION_URL'> <value><![CDATA[{CONNECTION_URL}]]></value> </resourceProperty> </resourceDescriptor> </request>"

                    var RequestXML = createXML.replaceAll("{DATASOURCE_NAME}", datasourceName)
                    RequestXML = RequestXML.replaceAll("{DATASOURCE_DESC}", 'Server ' + str[3] + ' ' + DBName)
                    RequestXML = RequestXML.replaceAll("{CONNECTION_URL}", ConnectionUrl);
                    RequestXML = RequestXML.replaceAll("{DBDRIVER}", DBDriver);
                    RequestXML = RequestXML.replaceAll("{USERNAME}", Username);
                    RequestXML = RequestXML.replaceAll("{PASSWORD}", Password);

                    _CallJSWebservice("PUT", RequestXML, function callbackCallJSWebservice() {
                        _PrintInfo('Current DataSource name in Jasperserver as ' + datasourceName, null)
                        mDataSourceName = datasourceName
                        return pCallback(datasourceName)
                    })
                }
            })
        }
    } catch (ex) {
        _PrintError('Error on GetDataSourceName()' + ex, '')
    }
}

// Get TranDB detail
function GetTranDBDetail(pTranDB) {
    try {
        var TranDBServerIP = ""
        var TranDBDatabase = ""
        var UserName = ""
        var Pwd = ""
        var Port = ""
        var ConnectionUrl = ''
        var DbType = ''
        var DBDriver = ''
        // get tranDB detail
        var TrnDB = pTranDB.DBConn.Connection

        if (pTranDB.DBConn.DBType.toUpperCase() == 'ORACLEDB') {
            var constr = TrnDB.client.connectionSettings.connectString
            //192.168.2.203:1521/ORATVL
            constr = constr.replaceAll('/', ':')
            var arrConfig = constr.split(':')
            TranDBServerIP = arrConfig[2]
            port = arrConfig[3]
            TranDBDatabase = arrConfig[4]
            UserName = TrnDB.client.connectionSettings.user
            Pwd = TrnDB.client.connectionSettings.password
            ConnectionUrl = 'jdbc:oracle:thin:@' + TranDBServerIP + ':' + port + ':' + TranDBDatabase
            DBDriver = 'oracle.jdbc.OracleDriver'
            DBType = 'ORA'
        } else { // Postgres TranDB
            var config = TrnDB.client.connectionSettings
            TranDBServerIP = config.host
            TranDBDatabase = config.database
            UserName = config.user
            Pwd = config.password
            Port = config.port
            ConnectionUrl = 'jdbc:postgresql://' + TranDBServerIP + ':' + Port + '/' + TranDBDatabase
            DBDriver = 'org.postgresql.Driver'
            DBType = 'PG'
        }
        _PrintInfo('TranDB Info : ' + TranDBServerIP + ';' + Port + ';' + TranDBDatabase + ';' + UserName + ';' + Pwd, null)
        return TranDBServerIP + ';' + Port + ';' + TranDBDatabase + ';' + UserName + ';' + Pwd + ';' + ConnectionUrl + ';' + DBType + ';' + DBDriver
    } catch (ex) {
        _PrintError('Error on GetTranDBDetail()' + ex, '')
    }
}

// Modify main report jrxml in Jasperserver
function ModifyMainreportJrxml(pMainRptName, pMainRptDesc, pMainRptJrxml, pHshSubreport, pTranDB, pCallback) {
    try {
        _ChangeMainReportJrxml(pMainRptJrxml, pHshSubreport, function callbackChangeMainReportJrxml(pJrxml) {
            GetDataSourceName(pTranDB, function callback(pDataSource) {

                // Change datasourcename
                pJrxml = _ChangeDataSourceName(pJrxml, pDataSource)

                pMainRptJrxml = pJrxml
                var RptFilePath = path.join(mFolderName, pMainRptName + ".jrxml")
                reqFs.writeFile(RptFilePath, pMainRptJrxml, function (err) {
                    RUNJAR(path.join(__dirname, "PublishReport.jar"), 'MAIN', 'MODIFY', pMainRptName, pMainRptDesc, '', pDataSource, function (pStatus) {
                        pCallback('SUCCESS')
                    })
                })
            })
        })
    } catch (ex) {
        _PrintError('Error on ModifyMainreportJrxml()' + ex, '')
    }
}

// Add new subreport into Mainreport in Jasperserver
function AddSubReport(pMainReportName, pSubRptName, pSubRptJrxml, pCallback) {
    try {
        var RptFilePath = path.join(mFolderName, pSubRptName + ".jrxml")
        reqFs.writeFile(RptFilePath, pSubRptJrxml, function (err) {
            RUNJAR(path.join(__dirname, "PublishReport.jar"), 'SUB', 'ADD', pMainReportName, pMainReportName, pSubRptName, '', function (pStatus) {
                pCallback('SUCCESS')
            })
        })
    } catch (ex) {
        _PrintError('Error on AddSubReport()' + ex, '')
    }
}

// Modify the subreport jrxml in JasperServer
function ModifySubReportJrxml(pMainReportName, pSubRptName, pSubRptJrxml, pCallback) {
    try {
        var RptFilePath = path.join(mFolderName, pSubRptName + ".jrxml")
        reqFs.writeFile(RptFilePath, pSubRptJrxml, function (err) {
            RUNJAR(path.join(__dirname, "PublishReport.jar"), 'SUB', 'MODIFY', pMainReportName, pMainReportName, pSubRptName, '', function (pStatus) {
                pCallback('SUCCESS')
            })
        })
    } catch (ex) {
        _PrintError('Error on ModifySubReportJrxml()' + ex, '')
    }
}

function SetConfig(pProperty, pValue) {
    switch (pProperty.toUpperCase()) {
        case 'SERVER':
            mServer = pValue
            break;
        case 'PORT':
            mPort = pValue
            break;
        case 'USERNAME':
            mUsername = pValue
            break;
        case 'PASSWORD':
            mPassword = pValue
            break;
        default:
            break;
    }
}

function SetFolderPath(pDirName) {
    mFolderName = pDirName
}

function _PrintError(pMessage, pErrorCode) {
    // console.log('ClientDeploy : ' + pMessage)
    reqInstanceHelper.PrintError('ReportHelper', pMessage, pErrorCode, null);
}

function _PrintInfo(pMessage, pLogInfo) {
    //console.log('ReportHelper : ' + pMessage)
    reqInstanceHelper.PrintInfo('ReportHelper', pMessage, pLogInfo);
}

module.exports = {
    SetConfig: SetConfig,
    SetFolderPath: SetFolderPath,
    SessionVariable: mSessionVariable,
    InitializeJasperServer: _InitializeJasperServer,
    IsReportExist: IsReportExist,
    PublishNewReport: PublishNewReport,
    ModifyMainreportJrxml: ModifyMainreportJrxml,
    AddSubReport: AddSubReport,
    ModifySubReportJrxml: ModifySubReportJrxml,
    DeleteSubReport: DeleteSubReport,
    DeleteMainReport: DeleteMainReport
}