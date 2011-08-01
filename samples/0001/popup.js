/*
 * DISPLAY/BEHAVIOR of Commenting Sign In/Registration UI
 */
    jQuery(document).ready(function(){
    // Sign In Or Register/Registration Form Swap
        jQuery("#register_text").click(function(){
            if(jQuery.browser.msie){
                document.getElementById('sign_in_or_register').style.display = 'none';
                document.getElementById('register_mod').style.display = 'block';
            }else{
                jQuery("#sign_in_or_register").slideUp("fast");
                jQuery("#register_mod").slideDown("fast");
            }
        });

        jQuery("#login_text").click(function(){
            if(jQuery.browser.msie){
                document.getElementById('sign_in_or_register').style.display = 'block';
                document.getElementById('register_mod').style.display = 'none';
            }else{
                jQuery("#register_mod").slideUp("fast");
                jQuery("#sign_in_or_register").slideDown("fast");
            }
        });

    // Forgot Password Popup
        jQuery("#forgot_password_text").click(function(){
            loadFPPopup();
        });
        jQuery("#forgot_password_close").click(function(){ //Click the x event!
            disableFPPopup();
        });
        jQuery("#forgot_password_bg").click(function(){ //Click out event!
            disableFPPopup();
        });
        jQuery(document).keypress(function(e){ //Press Escape event!
            if(e.keyCode==27 && fpPopupStatus==1){
                disableFPPopup();
            }
        });

    // Supporting Functions
        function loadFPPopup(){
            jQuery("#forgot_password_bg").css({
            "opacity": "0.7"
            });
            jQuery("#forgot_password_bg").fadeIn("slow");
            jQuery("#forgot_password_module").fadeIn("slow");
        }
        function disableFPPopup(){
            jQuery("#forgot_password_bg").fadeOut("slow");
            jQuery("#forgot_password_module").fadeOut("slow");
        }
    });
/* END DISPLAY BEHAVIOR */


/*
 * AJAX/EVENT HANDLERS for Commenting Sign In/Registration UI
 */
    jQuery(document).ready(function() {
        jQuery("#loginLink").click(function() {
            showStatus("sign_in_status");
            jQuery.post("/user/login/light", { username: jQuery("#username").val(), password: jQuery("#password").val() , rememberme: jQuery("#rememberMe").is(":checked")},
                function(json){
                    hideStatus("sign_in_status");
                    if(json.loginSuccess == true) {
                        handleLoginSuccessful();
                    }
                    else {
                        handleLoginFailure(json);
                    }
                }, "json");
        });
        jQuery("#register_link").click(function() {
            showStatus("register_status");
            hideErrors();
            jQuery.post("/user/registration/light", { email: jQuery("#reg_email").val(), username: jQuery("#reg_username").val(), password1: jQuery("#reg_password1").val(), password2: jQuery("#reg_password2").val(), optin1: jQuery("input:radio[name=optin1]:checked").val() == undefined ? "":jQuery("input:radio[name=optin1]:checked").val(), optin2: jQuery("input:radio[name=optin2]:checked").val() == undefined ? "":jQuery("input:radio[name=optin2]:checked").val(), applicationId: 89, command: "submit", formName: "account_settings", "toolkit.applicationId":89, partnerCode:"", sourceCode:"" },
                function(json){
                    hideStatus("register_status");
                    if(json.registrationSucess == true) {
                        handleRegistrationSuccessful();
                    }
                    else {
                        handleRegistrationFailure(json);
                    }
                }, "json");
        });
        jQuery("#forgot_password_submit").click(function() {
            showStatus("forgot_password_status");
            jQuery.post("/user/forgot_password/light", { username: jQuery("#fp_username").val(), email: jQuery("#fp_email").val() },
                function(json){
                    hideStatus("forgot_password_status");
                    if(JSON.stringify(json) == "{}") {
                        handleFPSuccessful();
                    }
                    else {
                        handleFPFailure();
                    }
                }, "json");
        });
        jQuery("#logout_text").click(function() {
            jQuery("#statusIcon").show("fast");
            jQuery.post("/user/logout/light", {},
                function(data){
                    location.reload();
                }, "json");
        });
        jQuery("#submit_comment").click(function() {
            if(jQuery.trim(jQuery("#comment").val()) == "") {
                showError("commentError", "Please enter a comment.");
                return false;
            }
        });

        // Supporting Functions
        function handleLoginSuccessful() {
            if(document.location.href.indexOf("#comments") == -1) {
                document.location.href = window.location + "#comments";
            }
            location.reload();
        }
        function handleLoginFailure(json) {
            if(json.attemptLimitReached) {
                jQuery("#loginError").html("Login attempt limit reached. Please try again later.");
            }
            else {
                jQuery("#loginError").html("Please enter a valid username and password");
            }
        }
        function handleRegistrationSuccessful() {
            location.reload();
        }
        function handleRegistrationFailure(json) {
            var jsonStr = JSON.stringify(json);
            var res = jsonStr.replace("org.springframework.validation.BindingResult.form","form");
            var parsedJSON = JSON.parse(res);
            for(var i=0; i<parsedJSON.form.fieldErrorCount; i++) {
                showError(parsedJSON.form.fieldErrors[i].field + "_msg", parsedJSON.form.fieldErrors[i].defaultMessage,parsedJSON.form.fieldErrors[i].field + "_info");
            }
            for(var i=0; i<parsedJSON.form.globalErrorCount; i++) {
                showError(parsedJSON.form.globalError.code + "_msg", parsedJSON.form.globalError.defaultMessage, parsedJSON.form.globalError.code + "_info");
            }
        }
        function handleFPSuccessful() {
            jQuery("#fpError").html("Password Sent. Please check your email for your password");
        }
        function handleFPFailure() {
            jQuery("#fpError").html("Error retrieving your password");
        }
        function showError(msgElemId, msg, infoId) {
            var globalMsgElt = document.getElementById("regError");
            var fieldMsgElt =  document.getElementById(msgElemId);
            var theInfoElt = document.getElementById(infoId);
            var theMsgElt = (fieldMsgElt ? fieldMsgElt : globalMsgElt);
            if(theMsgElt){
                theMsgElt.style.display = 'block';
                theMsgElt.innerHTML = msg;
            }
            if(theInfoElt){
                theInfoElt.style.display = 'none';
            }
        }
        function hideErrors(){
            jQuery(".regError").css("display", "none");
            jQuery(".regError").html("");
        }
        function showStatus(id){ //for status icons
            jQuery("#"+id).css("display", "inline");
        }
        function hideStatus(id){ //for status icons
            jQuery("#"+id).css("display", "none");
        }
    });