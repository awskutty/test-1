/*
@Api_Name           : /Bind Attachment,
@Description        : To Load Attachments from  DB for a particular attachments 
@Last_Error_code    : ERR-RES-70110
*/

// Require dependencies
var reqExpress = require('express');
var path = require('path');
var fs = require('fs');
var fileExists = require('file-exists');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqResourceHelper = require('./helper/ResourceHelper.js');
var request = require('request');
var encryptor = require('file-encryptor');
var sha1 = require('sha1');
var crypto = require('crypto');
var reqInsHelper = require('../../../../torus-references/common/InstanceHelper');
var strServiceName = 'Bind Attachment';
// Initialize Global variables
var strResult = '';
var strMessage = '';
var router = reqExpress.Router();

// Host the api to server
router.post('/BindAttachment', function (appRequest, appResponse, pNext) {

    var objLogInfo;
    var byteStr = '';
    try {


        function AttachmentViewerResult() {
            this.AttachmentDetails = new AttachmentDetails().AttachmentDetails;
            this.ATData = [];
            this.ATCode = '';
            this.ThumbData = [];
            this.Actions = [];
            this.TotalPages = '';
            this.NeedPaging = '';
            this.NeedAnnotation = '';
            this.AttachmentName = '';
            this.AttachmentId = '';
            this.ViewSessionId = '';
            this.Annotations = new Annotations().Annotations;
            this.CBOStampAnnotations = '';
        }

        function AttachmentDetails() {
            this.AttachmentDetails = [{
                FilePath: '',
                Userid: '',
                strURL: '',
                ATCode: '',
                ViewerType: '',
                ATData: [],
                WaterMarkText: '',
                font: '',
                fontsize: '',
                Actions: [],
                Transparency: '',
                PageNo: 1,
                AttId: 0,
                VWFTPA_ID: 0,
                LoadPageByPage: '',
                AccusoftHostName: '',
                NeedEncryption: '',
                ImageColor: '',
                ImageFormat: '',
                Dttadif_id: 0,
                Dttad_id: '',
                //Cassandra Details
                RS_DB_INFO: '',
                RS_STORAGE_TYPE: '',
                NeedAnnotation: '',
                CBOStampAnnotations: '',
                Annotations: new Annotations,
                GroupId: '',
                VersionNo: '',
                CheckOutBy: '',
                CheckOutByName: '',
                CheckOutDate: '',
                IsCurrent: '',
                OriginalFileName: ''
            }];
        }

        function Annotations() {
            this.Annotations = [{
                AnnotationId: 0,
                AnnotationType: '',
                AnnotationData: '',
                AnnotationText: ''
            }];
        }

        var params = appRequest.body.PARAMS;
        strResult = '';
        strMessage = '';
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {

            // Handle the close event when client closes the api request
            appResponse.on('close', function () { });
            appResponse.on('finish', function () { });
            appResponse.on('end', function () { });
            objLogInfo.HANDLER_CODE = 'BIND_ATTACHMENT';
            var sessionInfoKeys = Object.keys(objSessionInfo);
            // This loop is for merge session values with params
            for (var i = 0; i < sessionInfoKeys.length; i++) {
                var currentKey = sessionInfoKeys[i];
                params[currentKey] = objSessionInfo[currentKey];
            }
            try {
                _PrintInfo('Begin');
                pHeaders = appRequest.headers;
                reqDBInstance.GetFXDBConnection(pHeaders, 'res_cas', objLogInfo, function (pClient) {
                    reqDBInstance.GetFXDBConnection(pHeaders, 'dep_cas', objLogInfo, function (depcas) {
                        var RelativePath = '';
                        var PccConfig = reqResourceHelper.PccConfig;
                        _PrintInfo('Got res_cas instance successfully. Calling AssignattachmentoDetail');
                        var pAtmtDetails = params;
                        BindAttachment(appRequest, pAtmtDetails, params);

                        function BindAttachment(Request, pAtmtDetails, pParams) {
                            try {
                                if (pAtmtDetails.ViewerType == 'ACCUSOFT') {
                                    _PrintInfo('Viewer type is ACCUSOFT. Getting result from Accusoft viewer');
                                    GetAccusoftViewerResult(Request, pAtmtDetails, pParams);
                                } else if (pAtmtDetails.ViewerType == 'PDF') {
                                    _PrintInfo('Viewer type is PDF. Getting result for PDF viewer');
                                    GetNativeViewerResult(Request, pAtmtDetails, pParams);
                                } else {
                                    _PrintInfo('Viewer type is Native Viewer. Getting result for Native viewer');
                                    GetNativeViewerResult(Request, pAtmtDetails, pParams);
                                }
                            } catch (error) {
                                reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-RES-70101', 'FAILED TO BIND ATTACHMENTS DUE TO EXCEPTION', error);
                            }
                        }

                        // Prepare result For Native - Convert data into base64 string or byte data based on AT_CODE
                        function GetNativeViewerResult(Request, pAtmtDetails, pParams) {
                            var res = [];
                            res = new AttachmentViewerResult();
                            res.ATData = [];
                            res.ThumbData = [];
                            res.Actions = [];
                            res.Annotations = '';
                            res.AttachmentDetails.ATData = [];
                            res.AttachmentDetails.Actions = [];
                            res.AttachmentDetails.Annotations = '';
                            res.AttachmentDetails.AttId = Request.body.PARAMS.AttId;
                            var sb = reqResourceHelper.StringBuilder;
                            var sch = 'http';
                            sb.clear();
                            var del = '://';
                            var uri = Request.headers.host;
                            var strPhyPath = __dirname;
                            var strResourcepath = '';
                            var strFileExt = path.extname(pAtmtDetails.FilePath);
                            strFileExt = strFileExt.replace(/[.]/g, '');
                            var strTempPath = strResourcepath + '\\Temp_html\\';
                            var strContentToConvert = '';
                            var strUniqueId = pAtmtDetails.Userid + "_Cont";
                            var strContentPath = strTempPath + strUniqueId + "\\";
                            var strAccusoftHostName = pAtmtDetails.AccusoftHostName ? pAtmtDetails.AccusoftHostName : '';
                            _PrintInfo('Accusoft Host Name is ' + strAccusoftHostName);
                            try {
                                if (strAccusoftHostName == "") {
                                    strAccusoftHostName = "localhost";
                                }
                                if (strAccusoftHostName.indexOf(":") == -1) {
                                    strAccusoftHostName = strAccusoftHostName + ":18680";
                                }
                                if (!fs.existsSync(strTempPath)) {
                                    fs.mkdirSync(strTempPath);
                                }
                                strContentToConvert = strTempPath + strUniqueId + strFileExt;
                                var strAPIUri = sch + del + uri + '/api/Resource/ShowMedia';
                                //Resource Server detail
                                var RS_Storage_Type = pAtmtDetails.RS_STORAGE_TYPE;
                                if (RS_Storage_Type != "" && RS_Storage_Type == "DB") {
                                    // DB act as resource server
                                    strContentToConvert = pAtmtDetails.FilePath;
                                } else {
                                    // File system act as resource server
                                    if (pAtmtDetails.NeedEncryption = "Y") {
                                        if (!fileExists(strContentToConvert)) {
                                            fs.copy(pAtmtDetails.FilePath, strContentToConvert);
                                        }
                                        var strB64 = DecryptFile(strContentToConvert, strContentToConvert, "OASISGSS");
                                        var newByt = new Buffer.from(strB64).toString('base64');
                                        if (fs.ensureFile(strContentToConvert)) {
                                            fs.unlink(strContentToConvert);
                                        }
                                        if (newByt.Length > 0) {
                                            fs.writeFile(strContentToConvert, newByt);
                                        } else {
                                            strContentToConvert = pAtmtDetails.FilePath;
                                        }
                                    }
                                }
                                res.ATCode = pAtmtDetails.ATCode;
                                res.ImageFormat = pAtmtDetails.ImageFormat;
                                var lstResult = [];
                                switch (pAtmtDetails.ATCode) {
                                    case "IMG":
                                        var strBase64 = '';
                                        if (RS_Storage_Type != '' && RS_Storage_Type == "DB") {
                                            //                     //resource from cassandra DB
                                            var RelativePath = path.basename(strContentToConvert);
                                            GetAttachmentFromDB(RelativePath, pAtmtDetails.ATCode, function (bytData) {
                                                if (bytData && bytData != 'No Image') {
                                                    var tifCheckingObj = {
                                                        strFileExt: strFileExt,
                                                        bytData: bytData,
                                                        textData: byteStr
                                                    };
                                                    reqResourceHelper.CheckFileExtIsTIF(tifCheckingObj, function (error, IsTiff) {
                                                        // if (tiffBuffer) {
                                                        //     bytData = tiffBuffer;
                                                        // }
                                                        var resstring = '';
                                                        var OutputType = pAtmtDetails.OUT_TYPE;
                                                        strBase64 = new Buffer.from(bytData).toString('base64');
                                                        if (OutputType && OutputType.toUpperCase() == 'BASE64ONLY') {
                                                            resstring = strBase64;
                                                        } else {
                                                            if (strFileExt.toLowerCase() != ".jpg" && strFileExt.toLowerCase() != ".jpeg") {
                                                                strFileExt = "jpeg";
                                                            }
                                                            strBase64 = reqResourceHelper.StringFormat("data:image/{0};base64,{1}", strFileExt, strBase64);

                                                            resstring = "<img style=height:100%;width:90%;zoom:normal src=" + strBase64 + "></img>";
                                                        }
                                                        lstResult.push(resstring);
                                                        if (strContentToConvert != pAtmtDetails.FilePath && fileExists(strContentToConvert)) {
                                                            fs.unlink(strContentToConvert);
                                                        }
                                                        res.ThumbData = [];
                                                        res.ATData = '';
                                                        res.Actions = pAtmtDetails.Actions;
                                                        res.ThumbData.push(pAtmtDetails.ATData);
                                                        res.ATData = lstResult;
                                                        res.IsTiff = IsTiff;
                                                        // For Image Zone wise co ordinates 
                                                        reqDBInstance.GetTableFromFXDB(depcas, 'dtt_info', [], {
                                                            dtt_code: params.DTT_CODE
                                                            // ,app_id: params.APP_ID
                                                        }, objLogInfo, function callbackdttinfo(err, result) {
                                                            if (err) {
                                                                reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-RES-70110', 'Error on dtt_info querying', err);
                                                            } else {
                                                                var dataformatJSON = JSON.parse(result.rows[0].dtt_dfd_json.replaceAll('\\', ''));
                                                                var dttdftarr = dataformatJSON.DATA_FORMATS;
                                                                var arrzonecor = [];
                                                                for (var df = 0; df < dttdftarr.length; df++) {
                                                                    var objzone = {};
                                                                    objzone.DF_CODE = dttdftarr[df].DF_CODE;
                                                                    objzone.DF_DESCRIPTION = dttdftarr[df].DF_DESCRIPTION;
                                                                    if (dttdftarr[df].IMG_COORDINATES != '' && dttdftarr[df].IMG_COORDINATES != undefined) {
                                                                        objzone.IMG_COORDINATES = dttdftarr[df].IMG_COORDINATES;
                                                                    } else {
                                                                        objzone.IMG_COORDINATES = '';
                                                                    }
                                                                    arrzonecor.push(objzone);
                                                                }
                                                                res.DTTDIF = arrzonecor;
                                                                SuccessCallback(res);
                                                            }
                                                        });
                                                    });
                                                } else {
                                                    SuccessCallback('No Image Data in cassandra Db');
                                                }
                                            });
                                        }
                                        break;
                                    case "MP3":
                                        fs.writeFile(strPhyPath + "/Temp/" + pAtmtDetails.Userid + ".txt", strContentToConvert);
                                        strAPIUri = strAPIUri + reqResourceHelper.StringFormat("/{0}/{1}", pAtmtDetails.Userid + ".txt", strFileExt);
                                        sb.append("<audio style= width:100% controls><source src=" + strAPIUri + "type=audio/mpeg></audio>");
                                        lstResult.push(sb.ToString());
                                        res.Actions = pAtmtDetails.Actions;
                                        res.ThumbData.push(pAtmtDetails.ATData);
                                        res.ATData = lstResult;
                                        SuccessCallback(res);
                                        break;
                                    default:
                                        if (pAtmtDetails.ViewerType == 'PDF' || pAtmtDetails.ViewerType == 'NATIVE') {
                                            if (res.ATCode == 'PDF') {
                                                GetAttachmentFromDB(path.basename(pAtmtDetails.FilePath), pAtmtDetails.ATCode, function (bytData) {
                                                    var dataUrl = '';
                                                    if (bytData && bytData != 'No Image') {
                                                        dataUrl = 'data:application/pdf;base64,' + bytData.toString('base64');
                                                    } else {
                                                        dataUrl = 'No Image Data in Db';
                                                    }
                                                    res.ATData.push(dataUrl);
                                                    res.ThumbData.push(pAtmtDetails.ATData);
                                                    res.Actions = pAtmtDetails.Actions;
                                                    SuccessCallback(res);
                                                });
                                            } else {
                                                res.ATData = ['PDF Viewer not supported this Content type - ' + res.ATCode];
                                                SuccessCallback(res);
                                                break;
                                            }
                                        } else {
                                            res.ATData = ['Native Viewer not supported this Content type - ' + res.ATCode];
                                            SuccessCallback(res);
                                            break;
                                        }
                                }
                            } catch (error) {
                                reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-RES-70102', "Error while loading Attachments from NativeViewer - ", error);
                            }
                        }

                        // Get Result for Accusoft by calling Accusoft server url
                        function GetAccusoftViewerResult(Request, pAtmtDetails, pParams) {
                            var sch = 'http';
                            var del = '://';
                            var uri = Request.headers.host;
                            var strPhyPath = __dirname;
                            var strResourcepath = '';
                            var strFileExt = path.extname(pAtmtDetails.FilePath);
                            var strTempPath = strResourcepath + '\\Temp_html\\';
                            var strContentToConvert = '';
                            var strUniqueId = pAtmtDetails.Userid + "_Cont";
                            var strContentPath = strTempPath + strUniqueId + "\\";
                            var strAccusoftHostName = pAtmtDetails.AccusoftHostName;
                            var res = [];
                            res = new AttachmentViewerResult();
                            var lstRes = res;
                            lstRes.ATData = [];
                            lstRes.ThumbData = [];
                            lstRes.Actions = [];
                            lstRes.Annotations = '';
                            lstRes.AttachmentDetails.ATData = [];
                            lstRes.AttachmentDetails.Actions = [];
                            lstRes.AttachmentDetails.Annotations = '';
                            try {
                                if (!fs.existsSync(strTempPath)) {
                                    fs.mkdirSync(strTempPath);
                                }
                                strContentToConvert = strTempPath + strUniqueId + strFileExt;
                                var strAPIUri = sch + del + uri + '/node/Resource/ShowMedia';
                                //              Resource Server detail
                                var RS_Storage_Type = pAtmtDetails.RS_STORAGE_TYPE;
                                if (RS_Storage_Type != "" && RS_Storage_Type == "DB") {
                                    // DB act as resource server
                                    strContentToConvert = pAtmtDetails.FilePath;
                                } else { // File system act as resource server
                                    if (pAtmtDetails.NeedEncryption == "Y") {
                                        if (!fs.existsSync(strContentToConvert)) {
                                            fs.copy(pAtmtDetails.FilePath, strContentToConvert);
                                        }

                                        var strB64 = DecryptFile(strContentToConvert, strContentToConvert, "OASISGSS");
                                        var newByt = new Buffer.from(strB64).toString('base64');
                                        if (fs.ensureFilestr(ContentToConvert)) {
                                            fs.unlink(strContentToConvert);
                                        }
                                        if (newByt.Length > 0) {
                                            fs.writeFile(strContentToConvert, newByt);
                                        }
                                    } else {
                                        strContentToConvert = pAtmtDetails.FilePath;
                                    }
                                }
                                lstRes.ATCode = pAtmtDetails.ATCode;
                                lstRes.AttachmentId = pAtmtDetails.AttId;
                                _PrintInfo('AT code - ' + pAtmtDetails.ATCode + ' and Attachment Id - ' + pAtmtDetails.AttId);
                                if (pAtmtDetails.ViewerType == "ACCUSOFT") {
                                    switch (pAtmtDetails.ATCode) {
                                        case "MP3":
                                            var mp3sb = reqResourceHelper.StringBuilder;
                                            //  var strRelativePath = GetfilesfromDir(strContentToConvert)
                                            strAPIUri = strAPIUri + reqResourceHelper.StringFormat("?pFilePath={0}&pExtension={1}" + "," + "," + "TRNA_DATA" + "," + pAtmtDetails.ATCode, strFileExt);
                                            mp3sb.append("<audio style=\"width:100%\" controls><source src=\" & strAPIUri & \" type=\"audio/mpeg\"></audio>");
                                            lstRes.ATData.push(mp3sb);
                                            PrepareResultObject(lstRes, pAtmtDetails, pParams);
                                            break;
                                        case "AVI":
                                            var avsb = new StringBuilder;
                                            var strRelativePath = GetfilesfromDir(strContentToConvert);
                                            var strAPIUri = strAPIUri + reqResourceHelper.StringFormat("?pFilePath={0}&pExtension={1}", strRelativePath + "," + "TRNA_DATA" + "," + pAtmtDetails.ATCode, strFileExt);
                                            avsb.append("<video width=\"100%\" height=\"100%\" onended=\"setReplay(1);\" controls><source src=\" + strAPIUri + \" ></video>");
                                            lstRes.ATData.push(avsb);
                                            PrepareResultObject(lstRes, pAtmtDetails, pParams);
                                            break;
                                        default:
                                            var strBase64 = "";
                                            var RelativePath = strContentToConvert; // resource from cassandra DB
                                            lstRes.AttachmentName = RelativePath;
                                            if (RS_Storage_Type != "" && RS_Storage_Type == "DB") {
                                                _PrintInfo('Getting byte data from DB. Relative path - ' + RelativePath);
                                                GetAttachmentFromDB(RelativePath, pAtmtDetails.ATCode, function (bytData) {
                                                    if (bytData != 'No Image') {
                                                        fromDocumentName(Request, RelativePath, bytData, pAtmtDetails.FilePath, RS_Storage_Type, function (response) {
                                                            if (response) {
                                                                lstRes.ViewSessionId = response;
                                                                PrepareResultObject(lstRes, pAtmtDetails, pParams);
                                                            }
                                                        });
                                                    } else {
                                                        _PrintInfo('No Image in cassandra Db');
                                                        reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-RES-70103', 'No Image Data in Framework Db', null);
                                                    }
                                                });
                                            }
                                            // resource from FILE_SYSTEM        
                                            else {
                                                if (!fs.ensureFilestr(strContentToConvert)) {
                                                    lstRes.AttachmentName = "No Image";
                                                    return lstRes;
                                                }
                                            }
                                            break;
                                    }
                                }

                            } catch (error) {
                                reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-RES-70104', 'Error while loading Attachments from Accousoft Viewer', null);
                            }
                        }

                        function DeleteTargetFiles(strConverted) {
                            if (!fs.exists(strConverted)) {
                                fs.rmdir(strConverted);
                            }
                        }

                        function GetResult(options, callback) {
                            request({
                                uri: options.url,
                                method: options.method,
                                body: options.body,
                                json: true,
                                headers: options.headers
                            }, function (err, httpResponse, body) {
                                if (err) {
                                    reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-RES-70105', "Accousoft status-" + err + httpResponse.statusCode + httpResponse.statusMessage, err);
                                } else {
                                    _PrintInfo("Accousoft status-" + httpResponse.statusCode, httpResponse.statusMessage);
                                    return callback(body);
                                }
                            });
                        }

                        function GetResultByte(options, callback) {
                            request({
                                uri: options.url,
                                method: options.method,
                                body: options.body,
                                headers: options.headers,
                                encoding: null
                            }, function (err, httpResponse, body) {
                                if (err) {
                                    _PrintInfo(err);
                                    SuccessCallback("Accousoft status-" + err);

                                } else {
                                    _PrintInfo("Accousoft status-" + httpResponse.statusCode, httpResponse.statusMessage);
                                    return callback(body);
                                }

                            });
                        }


                        //Function for Get Attachment for database

                        function GetAttachmentFromDB(pRelativePath, pAT_CODE, callback) {
                            try {
                                var byteData = '';
                                var cond = new Object();
                                cond.RELATIVE_PATH = pRelativePath.toUpperCase().trim();
                                if (pAT_CODE == 'IMG') {
                                    reqDBInstance.GetTableFromFXDB(pClient, 'TRNA_DATA', ['text_data'], cond, objLogInfo, function (error, result) {
                                        if (error) {
                                            reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-RES-70105', 'Error While Getting Dtt_info', error);
                                        } else {
                                            if (result.rows != '' && result.rows != undefined) {
                                                var rs = result.rows[0];
                                                byteStr = rs.text_data;
                                                byteData = new Buffer.from(byteStr, 'base64');
                                                _PrintInfo("Fetched" + pRelativePath + "In cassandra");
                                                return callback(byteData);
                                            } else {
                                                _PrintInfo("No image for" + pRelativePath + "In cassandra");
                                                return callback('No Image');
                                            }

                                        }
                                    });
                                } else {
                                    reqDBInstance.GetTableFromFXDB(pClient, 'TRNA_DATA', ['byte_data'], cond, objLogInfo, function (error, result) {
                                        if (error) {
                                            reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-RES-70106', 'Error While Getting Dtt_info', error);
                                        } else {
                                            if (result.rows != '') {
                                                var rs = result.rows[0];
                                                byteData = rs.byte_data;
                                                _PrintInfo("Fetched" + pRelativePath + "In cassandra");
                                                return callback(byteData);
                                            } else {
                                                _PrintInfo("No image for" + pRelativePath + "In cassandra");
                                                return callback('No Image');
                                            }
                                        }
                                    });
                                }

                            } catch (error) {
                                reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-RES-70107', 'Error while loading GetAttachmentFromDB', error);
                            }
                        }

                        function fromDocumentName(Request, documentName, pDocSize, pFilePath, pStorageType, callback) {
                            //Get the full document path

                            var documentPath = documentName;

                            // Get the document's extension because PCCIS will need it later.
                            var extension = path.extname(documentPath);
                            extension = extension.substring(1);
                            _PrintInfo(extension);
                            var documentStream = '';
                            if (pStorageType == 'DB') {
                                documentStream = new Buffer.from(pDocSize);
                            } else {
                                //To be Changed into node coding
                                documentStream = new FileStream(pFilePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
                            }
                            //Create a viewing session using the stream
                            fromStream(Request, documentStream, documentPath, extension, pDocSize, callback);

                        }

                        function fromStream(Request, fileStream, documentId, fileExtension, pDocSize, callback) {
                            var strdocument = '';
                            var viewsessionid = '';
                            // Request a new viewing session from PCCIS.
                            var pccuri = PccConfig.WebServiceScheme + ':' + '//' + PccConfig.WebServiceHost + ':' + PccConfig.WebServicePort + '/' + PccConfig.WebServicePath;
                            var uriString = reqResourceHelper.StringFormat("{0}/ViewingSession", pccuri);
                            var documentHash = GetSha1HashString(documentId);
                            var viewingSessionProperties = {};
                            // Store some information in PCCIS to be retrieved later.
                            _PrintInfo('Accousoft Url :' + pccuri);
                            viewingSessionProperties.tenantId = "My User ID";
                            viewingSessionProperties.externalId = documentId;
                            viewingSessionProperties.documentExtension = fileExtension;
                            viewingSessionProperties.startConverting = "initialPages";
                            viewingSessionProperties.contentType = "svg";
                            viewingSessionProperties.serverCaching = "full";
                            viewingSessionProperties.countOfInitialPages = 2;
                            // The following are examples of arbitrary information as key-value 
                            // pairs that PCCIS will associate with this document request.
                            var originInfo = {};
                            originInfo.ipAddress = '192.168.2.203';
                            originInfo.sourceDocument = documentId;
                            originInfo.documentMarkupId = documentHash;
                            viewingSessionProperties.origin = originInfo;
                            viewingSessionProperties.watermarkText = "Accusoft\nConfidential";
                            viewingSessionProperties.render = {
                                "flash": {
                                    "optimizationLevel": 1
                                },
                                "html5": {
                                    "alwaysUseRaster": false
                                }
                            };
                            var options = {
                                url: uriString,
                                method: "POST",

                                headers: {
                                    'Content-Type': 'application/json',
                                    'acs-api-key': PccConfig.ApiKey,
                                    'Accusoft-Affinity-Hint': documentHash
                                },
                            };
                            options.body = viewingSessionProperties;
                            _PrintInfo('Getting Accusoft viewer result with uri - ' + uriString);
                            GetResult(options, function (res) {
                                if (res != undefined) {
                                    //Upload File to PCCIS.
                                    //Note the "u" prefixed to the Viewing Session ID. This is required when providing
                                    viewsessionid = res.viewingSessionId; //  an unencoded Viewing Session ID, which is what PCCIS returns from the initial POST.
                                    uriString = reqResourceHelper.StringFormat("{0}/ViewingSession/u{1}/SourceFile?FileExtension={2}", pccuri, viewsessionid, fileExtension);
                                    var param = {
                                        url: uriString,
                                        method: "PUT",
                                        headers: {},
                                    };
                                    param.body = new Buffer.from(fileStream);
                                    _PrintInfo('Calling uri - ' + uriString);
                                    GetResultByte(param, function (res) {
                                        _PrintInfo('GetResultByte success. File initiated. Starting Session');
                                        startsession(pccuri, viewsessionid);
                                        return callback(viewsessionid);
                                    });

                                }
                            });
                        }

                        function startsession(pccuri, viewsessionid) {
                            // Start Viewing Session in PCCIS.
                            uriString = reqResourceHelper.StringFormat("{0}/ViewingSession/u{1}/Notification/SessionStarted", pccuri, viewsessionid);
                            var param = {
                                url: uriString,
                                method: "POST",

                                headers: {
                                    "acs-api-key": PccConfig.ApiKey
                                },
                            };
                            param.body = {
                                viwer: 'HTML5'
                            };
                            GetResult(param, function (res) {
                                _PrintInfo('session initiated');
                            });
                        }
                        //hashcode generator
                        function GetSha1HashString(pInputString) {
                            var generator = crypto.createHash('sha1');
                            generator.update(pInputString);
                            var res = generator.digest('hex').toUpperCase();
                            var newREs = '';
                            var j = 0;
                            for (var i in res) {
                                j = j + 1;
                                newREs = newREs + res[i];
                                if (j == 2 && i != res.length - 1) {
                                    j = 0;
                                    newREs = newREs + '-';
                                }
                            }
                            return newREs;
                        }
                        // Decryption 
                        function DecryptFile(sInputFilename, sOutputFilename, sKey) {
                            encryptor.decryptFile(sInputFilename, sOutputFilename, sKey, function (err) {
                                if (!err) {
                                    _PrintInfo('DecryptFile Success');
                                }
                            });
                        }

                        function SuccessCallback(res) {
                            _PrintInfo('success callback');
                            reqInsHelper.SendResponse(strServiceName, appResponse, res, objLogInfo, null, null, null);
                        }

                        function PrepareResultObject(pResult, pAtmtDetails, pattachments) {
                            pResult.NeedAnnotation = pAtmtDetails.NeedAnnotation;
                            pResult.Actions = pAtmtDetails.Actions;
                            pResult.Annotations = pAtmtDetails.Annotations;
                            pResult.CBOStampAnnotations = pAtmtDetails.CBOStampAnnotations;
                            pResult.ThumbData.push(pAtmtDetails.ATData);

                            pResult.AttachmentDetails = [pattachments];
                            SuccessCallback(JSON.stringify(pResult));
                        }

                        function GetfilesfromDir(ppath) {
                            fs.readdir(ppath, function (err, files) {
                                if (err) return;
                                files.forEach(function (f) {
                                    _PrintInfo('Files: ' + f);
                                });
                            });
                        }
                    });
                });
            } catch (error) {
                reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-RES-70108', 'Error In AssignLogInfo Detail', error);
            }
        });
    } catch (error) {
        reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-RES-70109', 'Error In BindAttachment', error);
    }
    // Print Log information
    function _PrintInfo(pMessage) {
        reqInsHelper.PrintInfo(strServiceName, pMessage, objLogInfo);
    }
});

module.exports = router;
/********* End of service ********/