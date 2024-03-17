/**
 * Description : To save the Email as attachment to corresponding target table and trn_attachments
 */

// Require dependencies
var reqExpress = require('express');
var path = require('path');
var fs = require('fs');
var fileExists = require('file-exists');
var reqDBInstance = require('../../instance/DBInstance');
var reqLogWriter = require('../../log/trace/LogWriter');
var reqLogInfo = require('../../log/trace/LogInfo');
var sha1 = require('sha1');
var filesize = require('file-size');
var leftPad = require('left-pad');
var MailParser = require("mailparser").MailParser;
var mailparser = new MailParser();
var mkdirp = require('mkdirp');
var async = require('async');
var PDFDocument = require('pdfkit');
//cassandra initialize

const imginsert = "insert into trna_data(TRNAD_ID,RELATIVE_PATH,TEXT_DATA) VALUES(NOW(),?,?)"
const docinsert = "insert into trna_data(TRNAD_ID,RELATIVE_PATH,BYTE_DATA) VALUES(NOW(),?,?)"
var objLogInfo = ''

function PrepareEmlAttachment(Request, pParams, pcallback) {
    try {
        var mainattachemnt = ''
        var emlattmtarray = []
        mkdirp(__dirname + '/TempAttachments', function(err) {
            var pFilename = pParams.Filename
            var ACCESSKEYINDEXVALUES = pParams.ACCESSKEYINDEXVALUES
            mainattachemnt = JSON.parse(pParams.AttachmentData)
            mainattachemnt = new Buffer.from(mainattachemnt, 'base64');
            var AttachmentPath = __dirname + '/TempAttachments/' + pFilename
            fs.writeFile(__dirname + '/TempAttachments/' + pFilename, mainattachemnt, function(err, data) {
                if (!err) {
                    fs.createReadStream(__dirname + '/TempAttachments/' + pFilename).pipe(mailparser);
                    mailparser.on("end", function(mail_object) {
                        mail_object.attachments.forEach(function(emlattachment) {
                            emlattmtarray.push(emlattachment)

                        })
                        var U_ID = pParams.USER_ID
                        var STRDirectoryName = path.dirname(AttachmentPath)
                        var STRfilename = pFilename
                        var result = ""
                        var File_Size = ''
                        var DT_CODE = pParams.DT_CODE
                        var DTT_CODE = pParams.DTT_CODE
                        if (pParams.File_size) {
                            File_Size = pParams.File_size
                        }
                        if (ACCESSKEYINDEXVALUES != "") {
                            STRDirectoryName = STRDirectoryName + "\\" + ACCESSKEYINDEXVALUES
                        }
                        if (!fs.existsSync(STRDirectoryName)) {
                            fs.mkdirSync(STRDirectoryName)
                        }
                        _InitializeDB(Request.headers, function callbackInitializeDB(pStatus) {
                            STRDirectoryName = path.join(STRDirectoryName, STRfilename)
                                //   fs.writeFile(STRDirectoryName, attachemnt, function write(err, data) {
                            var Messagebody = pFilename
                            var dr = {}
                            var ext = path.extname(Messagebody)
                            ext = ext.substring(1);
                            var TrnAttachmentlist = []
                            if (ext.toUpperCase() == 'TXT') {
                                var htTrnAttachment = []
                                var doc = new PDFDocument({
                                    compress: false
                                });
                                var pdffilename = __dirname + '/TempAttachments/' + Messagebody + '.PDF';
                                stream = doc.pipe(fs.createWriteStream(pdffilename));

                                var Totalsize = __GetFileSize(File_Size)
                                var Rel_path = GetRelativePath(U_ID)
                                Rel_path = Rel_path + path.extname(pFilename)
                                htTrnAttachment.push({
                                    "ORIGINAL_FILE_NAME": pFilename
                                })
                                htTrnAttachment.push({
                                    "RELATIVE_PATH": Rel_path
                                })
                                htTrnAttachment.push({
                                    "AT_CODE": "PDF"
                                })
                                htTrnAttachment.push({
                                    "FILE_SIZE": Totalsize
                                })

                                __PrepareData(Rel_path, mainattachemnt, "PDF", DT_CODE, DTT_CODE, pFilename, function(rescallback) {
                                    TrnAttachmentlist.push(htTrnAttachment)
                                    emlattachemnts(emlattmtarray, function(resultst) {
                                        TrnAttachmentlist.push(resultst[0])
                                        pcallback(TrnAttachmentlist)
                                    })
                                })

                            } else {
                                FileHandling(Messagebody, File_Size, ext, U_ID, DT_CODE, DTT_CODE, mainattachemnt, Request, function(pres) {
                                    TrnAttachmentlist.push(pres[0])
                                    emlattachemnts(emlattmtarray, U_ID, DT_CODE, DTT_CODE, Request, function(resultset) {
                                        TrnAttachmentlist.push(resultset[0])

                                        pcallback(TrnAttachmentlist)


                                    })

                                })

                            }

                        })


                    });
                }
            });
        });


    } catch (error) {
        var error = {
            "STATUS": "FAILURE",
            "ERROR_MESSAGE": "Error In PrepareEmlAttachment function in Eml Attachment Helper",
            "ERR_OBJ": error
        }
        pcallback(error)
    }

}

function emlattachemnts(pemlattachment, pU_ID, pDT_CODE, pDTT_CODE, pRequest, pemlcallback) {
    try {
        var emlres = {}
        async.forEachOf(pemlattachment, function(value, key, callback1) {
                var attext = path.extname(value.fileName)
                switch (attext.toUpperCase()) {

                    case ".DOC", ".DOCX":
                        FileHandling(value.fileName, value.length, "DOC", pU_ID, pDT_CODE, pDTT_CODE, value.content, pRequest, function(pres) {
                            emlres = pres
                            callback1()
                                //  pcallback(TrnAttachmentlist)
                        })
                        break;
                    case ".PPT", ".PPTX":
                        FileHandling(value.fileName, value.length, "PPT", pU_ID, pDT_CODE, pDTT_CODE, value.content, pRequest, function(pres) {
                            emlres = pres
                            callback1()
                                // pcallback(TrnAttachmentlist)
                        })
                        break;
                    case ".XLS", ".XLSX":
                        FileHandling(value.fileName, value.length, "XLS", pU_ID, pDT_CODE, pDTT_CODE, value.content, pRequest, function(pres) {
                            emlres = pres
                            callback1()
                                //pcallback(TrnAttachmentlist)
                        })
                        break;
                    case ".WEBM", ".MKV", ".FLV", ".OGV", ".OGG", ".DRC", ".MNG", ".AVI", ".MOV", ".QT", ".WMV", ".YUV", ".RM", ".RMVB", ".ASF", ".MP4", ".M4P", ".M4V", ".MPG", ".MP2", ".MPEG", ".MPE", ".MPV", ".SVI", ".3GP":
                        FileHandling(value.fileName, value.length, "AVI", pU_ID, pDT_CODE, pDTT_CODE, value.content, pRequest, function(pres) {
                            emlres = pres
                            callback1()
                                //pcallback(TrnAttachmentlist)
                        })
                        break;
                    case ".MP3", ".MP4", ".WAV":
                        FileHandling(value.fileName, value.length, "MP3", pU_ID, pDT_CODE, pDTT_CODE, value.content, pRequest, function(pres) {
                            emlres = pres
                            callback1()
                                // pcallback(TrnAttachmentlist)
                        })
                        break;
                    case ".JPEG", ".TIFF", ".JPG", ".BMP", ".PNG", "TIF":
                        FileHandling(value.fileName, value.length, "IMG", pU_ID, pDT_CODE, pDTT_CODE, value.content, Request, function(pres) {
                            emlres = pres
                            callback1()
                                // pcallback(TrnAttachmentlist)
                        })
                        break
                    default:
                        FileHandling(value.fileName, value.length, attext, pU_ID, pDT_CODE, pDTT_CODE, value.content, pRequest, function(pres) {
                            emlres = pres
                            callback1()
                                //pcallback(TrnAttachmentlist)
                        })
                        break;
                }
            },
            function(err) {
                if (!err) {
                    deleteFolderRecursive(__dirname + '\\ TempAttachments')
                    pemlcallback(emlres)
                }
            })
    } catch (error) {
        var error = {
            "STATUS": "FAILURE",
            "ERROR_MESSAGE": "Error In emlattachemnts function in Eml Attachment Helper",
            "ERR_OBJ": error
        }
        pemlcallback(error)
    }
}

function deleteFolderRecursive(path) {
    if (fs.existsSync(path)) {
        fs.readdirSync(path).forEach(function(file, index) {
            var curPath = path + "/" + file;
            if (fs.lstatSync(curPath).isDirectory()) { // recurse
                deleteFolderRecursive(curPath);
            } else { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
};

function FileHandling(pSourcefilename, pFile_Size, pAtCode, U_ID, pDT_CODE, pDTT_CODE, attachemnt, preq, callback) {
    try {
        var Filename = pSourcefilename
        GetRelativePath(U_ID, function(callbackres) {
            var unique_id = callbackres
            unique_id = unique_id + path.extname(pSourcefilename)
            var strresult = ""
            var htTrnAttach = []
            var size = __GetFileSize(pFile_Size)
            htTrnAttach.push({
                "ORIGINAL_FILE_NAME": pSourcefilename,
                "RELATIVE_PATH": unique_id,
                "AT_CODE": pAtCode.toUpperCase(),
                "FILE_SIZE": size
            })
            __PrepareData(unique_id, attachemnt, pAtCode.toUpperCase(), pDT_CODE, pDTT_CODE, pSourcefilename, preq, function(res) {
                // if (!fileExists(pSourcefilename)) {
                //     fs.unlink(pSourcefilename)
                // }
                Filename = ""
                callback(htTrnAttach)

            })
        })



    } catch (error) {
        var error = {
            "STATUS": "FAILURE",
            "ERROR_MESSAGE": "Error In FileHandling function in Eml Attachment Helper",
            "ERR_OBJ": error
        }
        callback(error)
    }

}

function _InitializeDB(pHeaders, pCallback) {
    try {
        reqDBInstance.GetFXDBConnection(pHeaders, 'res_cas', objLogInfo, function CallbackGetCassandraConn(pClientres) {
            mResClient = pClientres
            pCallback('Success')
        })

    } catch (error) {
        var error = {
            "STATUS": "FAILURE",
            "ERROR_MESSAGE": "Error In _InitializeDB function in Eml Attachment Helper",
            "ERR_OBJ": error
        }
        pCallback(error)
    }
}

function __GetFileSize(File_Size) {

    if (File_Size > 134217728) {

        return filesize(File_Size).to('GB') + "GB"
    } else if (File_Size >= 1048576) {

        return filesize(File_Size).to('MB') + " MB"
    } else if (File_Size >= 1024) {

        return filesize(File_Size).to('KB') + " KB"
    } else {
        return filesize(File_Size).to('B') + "bytes"
    }
}
//Attachment Insert to Cassandra
function __PrepareData(pRelativePath, pByteData, pAT_Code, pdtcode, pdttcode, FILE_NAME, preq, prescallback) {
    //trna_data insert
    try {
        var TextData = ""

        if (pAT_Code == "IMG") {
            TextData = new Buffer.from(pByteData).toString('base64');
            reqDBInstance.InsertFXDB(mResClient, 'trna_data', [{
                TRNAD_ID: '',
                RELATIVE_PATH: pRelativePath.toUpperCase().trim(),
                TEXT_DATA: TextData
            }], objLogInfo, function callbackcltsetup(err, result) {
                if (err) {
                    var error = {
                        "STATUS": "FAILURE",
                        "ERROR_MESSAGE": "Error In trna_data exection in Eml Attachment Helper",
                        "ERR_OBJ": err
                    }
                    prescallback(error)
                } else {
                    reqLogWriter.TraceInfo(objLogInfo, pRelativePath + 'Insert Success');
                    fs.unlinkSync(__dirname + '\\TempAttachments\\' + FILE_NAME);
                    prescallback('SUCCESS');
                }

            }, ['UUID', 'STRING', 'STRING'])
        } else {
            reqDBInstance.InsertFXDB(mResClient, 'trna_data', [{
                TRNAD_ID: '',
                RELATIVE_PATH: pRelativePath.toUpperCase().trim(),
                BYTE_DATA: pByteData
            }], objLogInfo, function trandatainsert(err, result) {
                if (err) {
                    var error = {
                        "STATUS": "FAILURE",
                        "ERROR_MESSAGE": "Error In trna_data exection in Eml Attachment Helper",
                        "ERR_OBJ": err
                    }
                    prescallback(error)
                } else {
                    // console.log(pByteData.length + pRelativePath.toUpperCase())
                    reqLogWriter.TraceInfo(objLogInfo, pRelativePath + 'Insert Success');
                    if (fs.existsSync(__dirname + '\\TempAttachments\\' + FILE_NAME)) {
                        fs.unlinkSync(__dirname + '\\TempAttachments\\' + FILE_NAME);
                    }
                    prescallback('SUCCESS')
                }

            }, ['UUID', 'STRING', 'BYTE'])
        }
    } catch (error) {
        var error = {
            "STATUS": "FAILURE",
            "ERROR_MESSAGE": "Error In __PrepareData function",
            "ERR_OBJ": error
        }
        prescallback(error)
    }
}
//GET Relative path for Filename
function GetRelativePath(U_ID, pcallback) {

    var intUniqueNo = 0
    var strUsrID = U_ID
    strUsrID = leftPad(strUsrID, 9, 0)
    var strCurrentDateAndTime = new Date()
    strCurrentDateAndTime = Date.parse(strCurrentDateAndTime)
    intUniqueNo = intUniqueNo + 1
    intUniqueNo = leftPad(intUniqueNo, 5, 0)
    return pcallback(strUsrID + strCurrentDateAndTime + intUniqueNo)
}
module.exports = {
    PrepareEmlAttachment: PrepareEmlAttachment
}
/********* End of File *************/