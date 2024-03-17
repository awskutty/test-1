/**
 * Description : To handle gateway api functions (current used gateway is Kong)
 */

// Require dependencies
var request = require('request');
var jwt = require('json-web-token');
var reqStringFormat = require('stringformat');
var pHeaders = '';

//User insert into KONG While create a new user prepare the url and mehod  and data
function CreateKongUser(user_id, user_name, url, pcallback) {
    var strResult = {};
    var strUrl = url.TORUS_API_GATEWAY_ADMIN.Url + "consumers";
    var PostData = {};
    PostData.username = user_name;
    PostData.custom_id = user_id;
    __GetHttpPostResponse(strUrl, "POST", PostData, "application/json", '', 1, function (callback) {
        if (callback) {
            strResult.status = 'SUCCESS';
            pcallback(strResult);
        } else {
            strResult.status = 'FAILURE';
            pcallback(strResult);
        }
    });
}

//Post method function call using the url and form data
function HttpFormDataRequest(pUri, pFormdata, formcallback) {
    request.post({
        uri: pUri.toString(),
        formData: pFormdata
    }, function (err, httpResponse, body) {
        if (err) {
            console.log(err);
        } else
            return formcallback(body);
    });
};


//Execute the requested method
function __GetHttpPostResponse(pUrl, pMethod, pPostData, pContentType, pHeaders, pTimeOut, callback) {
    try {
        if (pContentType) {
            isJson = pContentType.indexOf("application/json") > -1 ? true : false;
        }
        var headers = [{
            name: 'content-type',
            value: pContentType
        }];
        if (pHeaders) {
            pHeaders.forEach(function (header) {
                headers.push(header);
            });
        }
        request({
            uri: pUrl.toString(),
            method: pMethod.toString().toUpperCase(),
            body: pPostData,
            json: true,
            timeout: pTimeOut ? pTimeOut : false,
            headers: headers
        },
            function (err, httpResponse, body) {
                if (err) {
                    console.log(err);
                } else
                    body;
                return callback(body);
            });
    } catch (error) {
        return callback(error);
    }
}

//Delete the user from KONG
function DeleteKongUser(KONGurl, user_id, user_name) {
    var strUri = KONGurl.ADMIN_API.Url + "consumers" + "/" + user_name;
    __GetHttpPostResponse(strUri, 'DELETE', '', '', '', '', function (callback) {
        // deletecallback(strResult);
    });

}


//JWT Token Generation
function GetConsumerJwtCredential(pConsumername, pConsumerid, url, JWTcallback) {
    try {
        var strResult = {};
        strResult.Status = "";
        strResult.Token = "";
        strResult.Message = "";
        var strHmacKey = "";
        var strUri = reqStringFormat(url.TORUS_API_GATEWAY_ADMIN.Url + "consumers/{0}/jwt", pConsumername);
        var PostData = {};
        PostData.consumer_id = pConsumerid;
        HttpFormDataRequest(strUri, PostData, function (res) {
            if (JSON.parse(res).consumer_id != undefined && JSON.parse(res).consumer_id != '') {
                var objCredentialJson = JSON.parse(res);
                JWTEncryption(objCredentialJson.key, objCredentialJson.secret, function (jtocken) {
                    strResult.Status = "SUCCESS";
                    strResult.Token = jtocken;
                });
            } else {
                strResult.Status = "FAILURE";
                if (res) {
                    strResult.Message = JSON.parse(res).message;
                } else
                    strResult.Message = res;
            }
            JWTcallback(strResult);
        });
    } catch (error) {
        JWTcallback(error);
    }
};


//JWT Token encryption with secretkey
function JWTEncryption(Key, SecretKey, JWTencCallback) {
    try {
        var payload = {
            "iss": Key,
            "typ": "JWT",
            "alg": "HS256"
        };
        var EncSecret = SecretKey;
        var KeyLists = {};

        jwt.encode(EncSecret, payload, function (err, token) {
            if (err) {
                return console.error(err.name, err.message);
            } else {
                console.log(token);
                JWTencCallback(token);
            }
        });
    } catch (error) {
        JWTencCallback(error);
    }
}


function KongCredentialJson() {
    this.ConsumerId = "";
    this.Id = "";
    this.Secret = "";
    this.Key = "";
    this.CreatedAt = {};
    this.Algorithm = "";
}

module.exports = {
    CreateKongUser: CreateKongUser,
    GetConsumerJwtCredential: GetConsumerJwtCredential,
    DeleteKongUser: DeleteKongUser
};
/********* End of File *************/