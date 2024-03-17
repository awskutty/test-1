/****
 * Description - To encrypt and decrypt the password
 */

// Require dependencies
var crypto = require('crypto');
var CryptoJS = require('crypto-js');
var RandExp = require('randexp');
var reqInstanceHelper = require('../InstanceHelper');
var key = CryptoJS.enc.Utf8.parse('5061737323313235');
var iv = CryptoJS.enc.Utf8.parse('5061737323313235');

// Initialize variables
var key3DES = [189, 125, 83, 164, 3, 91, 202, 205, 194, 101, 45, 49, 125, 101, 189, 208, 173, 225, 214, 184, 163, 177, 187, 253];
var iv3DES = [140, 17, 176, 26, 79, 105, 194, 34];
var alg = 'des-ede3-cbc';
var serviceName = 'EncryptionInstance';
var objLogInfo = null;

// Encrypt string using 3DES-EDE3-CBC algorithm
function doEncrypt(str) {
    try {
        var cipher = crypto.createCipheriv(alg, new Buffer.from(key3DES), new Buffer.from(iv3DES));
        var ciph = cipher.update(str, 'ascii', 'binary');
        ciph += cipher.final('binary');
        var shasum = crypto.createHash('sha1');
        shasum.update(ciph);
        var buf = new Buffer.from(ciph, 'binary');
        var encrypted = buf.toString('hex') + shasum.digest('hex');
        return encrypted;
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230044', 'Error in doEncrypt function', error);
    }
}

// Decrypt string using 3DES-EDE3-CBC algorithm
function doDecrypt(str) {
    try {
        // var enc1 = str.substr(0, 48); // This code is changed because of lenth ; if more than 16 lenth pwd notable to decrypt.
        var hashLength = 40
        var enc1 = str.slice(0, -hashLength);
        var shaDecript = crypto.createHash('sha1');
        var buf = new Buffer.from(enc1, 'hex');
        shaDecript.update(buf.toString('binary'));
        var decipher = crypto.createDecipheriv(alg, new Buffer.from(key3DES), new Buffer.from(iv3DES));
        var txt = decipher.update(enc1, 'hex', 'ascii');
        txt += decipher.final('ascii');
        return txt;
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230043', 'Error in doDecrypt function', error);
    }
}

// Encrypt using sha1 and hex
function encryptPassword(strPassword) {
    try {
        //var crypto = require('crypto');
        var shasum = crypto.createHash('sha1');
        shasum.update(strPassword);
        var encryptedPwd = shasum.digest('hex').toUpperCase();
        return encryptedPwd;
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230042', 'Error in encryptPassword function', error);
    }
}

function passwordHash256(pwd) {
    try {
        var hash = crypto.createHash('sha256');
        hash.update(pwd);
        var hashespwd = hash.digest('hex').toUpperCase();
        return hashespwd;
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230046', 'Error in encryptPassword function', error);
    }
}



function passwordHash256Withsalt(pwd, SaltValue) {
    try {
        var hash = crypto.createHmac('sha256', SaltValue);
        hash.update(pwd);
        var SaltedPwd = hash.digest('hex');
        return SaltedPwd;
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230046', 'Error in encryptPassword function', error);
    }
}






// Decrypt password
function decryptPassword(strEncrypted) {
    try {
        var decrypted = CryptoJS.AES.decrypt(strEncrypted, key, {
            keySize: 128 / 8,
            iv: iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        });
        return CryptoJS.enc.Utf8.stringify(decrypted);
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230041', 'Error in decryptPassword function', error);
    }
}

function encryption(pVal) {
    try {
        var encrypted = CryptoJS.AES.encrypt(CryptoJS.enc.Utf8.parse(pVal), key, {
            keySize: 128 / 8,
            iv: iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        });
        return encrypted.ciphertext.toString(CryptoJS.enc.Base64);
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230045', 'Error in decryptPassword function', error);
    }
}

function decryptConfigFile(result) {
    var decipher = crypto.createDecipher('aes192', 'CONFIG_FILE_SECURITY');
    var decrypted = decipher.update(result.toString(), 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}


function getdynamicPwd(passwordPolicy, objLogInfo, pcallback) {
    try {
        var gendynpwd = new RandExp(passwordPolicy).gen();
        var pwdpatern = new RegExp(passwordPolicy);
        if (!pwdpatern.test(gendynpwd)) {
            //Not matched with pwd policy generate  pwd
            console.log('Password not matched to regex. Regenerate the pwd.');
            getdynamicPwd(passwordPolicy, objLogInfo, pcallback);
        } else {
            pcallback(gendynpwd);
        }
    } catch (error) {
        console.log('Exception occured ' + error);
    }
}

module.exports = {
    DoEncrypt: doEncrypt,
    DoDecrypt: doDecrypt,
    EncryptPassword: encryptPassword,
    DecryptPassword: decryptPassword,
    Encryption: encryption,
    DecryptConfigFile: decryptConfigFile,
    passwordHash256: passwordHash256,
    passwordHash256Withsalt: passwordHash256Withsalt,
    GetDynamicPwd: getdynamicPwd

};
/********* End of File *************/