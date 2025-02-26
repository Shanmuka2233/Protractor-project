var customlocator = require('..//util//customlocator.js');
var SelectWrapper = require('..//util//select-wrapper.js');
 var mycustomer = new SelectWrapper(by.id("userSelect"));
var mycurrency= new SelectWrapper(by.id("currency"));
var obj =require('../Object2.json');

var BankManagerinfo = function() {

//-----------------------------------------------------------addcustomerpage--------------------------------------------------------
    this.gotoBankmanagerpage = function(){
        browser.sleep(2000);
        element(by.ngClick(obj.locators.Bankmanagerpage.clickban)).click();
        browser.sleep(2000);
       
    };
    this.gotoaddcustomer = function(){

        element(by.ngClick(obj.locators.Bankmanagerpage.clickaddcus)).click();
        browser.sleep(2000);
       
    };
    this.addcustomerinfo = function(firstname,lastname,postcode,addcu){
        browser.sleep(2000);
        element(by.xpath(obj.locators.Bankmanagerpage.addfname)).sendKeys(firstname);
        element(by.xpath(obj.locators.Bankmanagerpage.addlname)).sendKeys(lastname);
        element(by.xpath(obj.locators.Bankmanagerpage.Postcode)).sendKeys(postcode);
        element(by.xpath(obj.locators.Bankmanagerpage.submit)).click();
        browser.sleep(1000);
        var alert = browser.switchTo().alert();
        alert.getText().then(function(text){

            console.log(text);
        });

        alert.accept();
        browser.sleep(2000);
       
    };
//----------------------------------------------------Openaccountpage-----------------------------------------------------------


this.gotoopenaccount = function(){

 element(by.ngClick(obj.locators.Bankmanagerpage.clickopen)).click();
  mycustomer.selectByValue(3);
    browser.sleep(2000);
    mycurrency.selectByValue("Dollar");
    element(by.xpath(obj.locators.Bankmanagerpage.submitprocess)).click();
    browser.sleep(2000);
    var alert = browser.switchTo().alert();
    alert.getText().then(function(text){

        console.log(text);
    });

    alert.accept();
    browser.sleep(2000);
};
//----------------------------------------------------customerpage-------------------------------------------------------------------
this.gotocustomer = function(){

    element(by.ngClick(obj.locators.Bankmanagerpage.clickcus)).click();
    browser.sleep(1000);
}

this.verifycustomerdetails = function(){

    element.all(by.repeater(obj.locators.Bankmanagerpage.verifymee).row(3)).getText().then(function(text){
        console.log(text);
});
}


   
};








module.exports = new BankManagerinfo();
