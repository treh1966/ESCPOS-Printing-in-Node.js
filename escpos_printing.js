//======================================================================================================================================================
// escpos_printing.js Version: 1.0.0 by Thomas Höbelt
//------------------------------------------------------------------------------------------------------------------------------------------------------
// This is my implementation of ESCPOS Printing from within node nw.js applications
// ADVANTAGE nothing else needed i.e. no dependencies except built in modules:
//'fs' , 'os' ( in fact only needed when using on multiple platforms), and 'child process'
// CEAVEAT: as its based on copying files to the printer-queue biderectional commands are not supported
// Tried to implement all basically necessary (and common betweeen printer models ) commands in an easy usable fashion
// FEEL FREE TO USE/MODIFY THE CODE IN ANY FASHION YOU LIKE
// comments and 'requests' as well as feedback or appreciation might be send to registrierkassa@ad-min.at
// TODO: improve error tracking & implement more of the full command list implement OSX
//------------------------------------------------------------------------------------------------------------------------------------------------------
// Prerequisites:
// At least one RAW-printer needs to be installed on the system :
// Under WINDOWS : just use the printer driver to install, most modern printers support both modes (driver and RAW) automatically
// and !!! share the printer using a NAME which will be listed when network shares are ealuated
// On LINUX (and OSX): just install a (driverless) RAW Printer it will be listed by lp
//------------------------------------------------------------------------------------------------------------------------------------------------------
// Usage:
// Printer = require('escpos_printing.js');
// Printer.ESCPOS_INIT();
// Printer.append(put commands and functions here);
// var sucess = Printer.ESCPOS_PRINT(currentPrinter);
//    if(!sucess){
//       alert(Printer.ESCPOS_LASTERROR);
//    }           
//------------------------------------------------------------------------------------------------------------------------------------------------------
// Functions summary:
// ESCPOS_INIT : Initialize globals and lists printers to array
// append : adds commands and Text to the "Print Buffer"
// ESCPOS_CMD : submit a command (as defined in the set)
// ESCPOS_PRINT : collect "Printer Buffer" write it to a prt file and send the file to the printer-queue
// ESCPOS_IMAGEFILE : print image from a file
// ESCPOS_BARCODE : Print Barcodes 
// ESCPOS_QRCODE : Print QR-Codes
// ESCPOS_CPBYNUMBER : Select a codepage ( Named Versions available as extra command sets)
// ESCPOS_CP_EPSON : Select codepage as defined by epson
// ESCPOS_CP_STAR : Select Codepage as defined by STAR using standard ESCPOS Command
// STAR_CP : Select codepage using a special command used by star printers
// ESCPOS_CHARSET : select international characterset
//------------------------------------------------------------------------------------------------------------------------------------------------------
// for more examples of usage look at main.js in the zip-file
//=======================================================================================================================================================


//=======================================================================================================================================================
// MODULES "GLOBAL" SECTION
var fileSys = require('fs');
var operatingSys = require('os');
var doIt = require("child_process").execSync;
//defaulting OS to whatever you like init function will detect appropriately
var OS = "WIN";
// this one is needed and must be set to whatever the language of your Win (cmd output) puts out for the Word "Printer"
// as mine is German i set it to the German Expression for Printer which is "Drucker"
var OS_PRINTERKEYWORD = "Drucker";
// this array will contain shared printers on Win and all lp printers on cups Systems
exports.ESCPOS_PRINTERLIST = [];
// needs to be filled with the calling mains window object which is done in the init function
// might skip this when using node 13 by using mixed context
var ESCPOS_MOTHER ="";
// Just in Case
exports.ESCPOS_LASTERROR = "";
// The thing we want to create: a fully formatted ESC/POS String
var ESCPOS_RESULT = "";
//=======================================================================================================================================================


//=======================================================================================================================================================
//ESCPOS_INIT
// Initialitiation of Output and printerlist
// should be called before every use because the require will cache code AND values
//-------------------------------------------------------------------------------------------------------------------------------------------------------
exports.ESCPOS_INIT = function  () {
var listCommand = "";
var listResult = "";
var listResultLines = [];
var listLineParts = [];
var detailParts = [];

// resetting the output to empty string
ESCPOS_RESULT = "";
// and the Errorstring
ESCPOS_LASTERROR = "";
// listing all relevant printers on Windows they need to be shared printers

// first detect OS defaulting it to whatever you like Win in this case
var osOriginal = operatingSys.platform();
switch (osOriginal) {
		case "win32":
			OS = "WIN";
			break;
		case "win64":
			OS = "WIN";
			break;
		case "darwin":
			OS = "OSX";
			break;
		case "linux":
			OS = "LINUX";
			break;
		default:
			OS = "WIN";
}
// resetting the printer-array;
exports.ESCPOS_PRINTERLIST.length = 0;

// running os specific command to detect printers i.e. net view on Windows lp on linux like
// using ifs here because if we vcant detect on which system we run its not worth the whole thing so no case/default scheme
if (OS=="WIN") {
			// this will return all network resources including printers
            var listCommand = 'net view \\\\localhost';
            // run the command and collect the output
			var listResult = doIt( listCommand,{encoding:'utf8'});
            // split output into single lines
			listResultLines = listResult.split("\n");
            // check items i.e. lines for the printer Keyword
			for(var d=0;d<listResultLines.length;d++){
				if (listResultLines[d].indexOf(OS_PRINTERKEYWORD)>0) {
                    listLineParts = listResultLines[d].split(OS_PRINTERKEYWORD);
                    //name is the first part so push it to printerlist
					exports.ESCPOS_PRINTERLIST.push(listLineParts[0].trim());
                }
			}   
        }

if (OS=="LINUX") {
			// better than win here, list printers only
            var listCommand = "lpstat -v";
            //run the command and collect output
			var listResult = doIt( listCommand,{encoding:'utf8'});
			 // split output into single lines
			listResultLines = listResult.split("\n");
			for(var d=0;d<listResultLines.length;d++){
				// lpstat delivers "device for PRINTERNAME : ADDITIONAL info"
                // so first check for colon (:) then split by the word for
                if (listResultLines[d].indexOf(":")>0) {
                    listLineParts = listResultLines[d].split(":");
					detailParts = listLineParts[0].split("for");
                    //name is the second part so push it
                    exports.ESCPOS_PRINTERLIST.push(detailParts[1].trim());
                }
			}            
        }
}
//=======================================================================================================================================================

//=======================================================================================================================================================
//append
// simply adds whatever we like to the modules output string
// used this (notation)  because originally i used qz plugin and dindnt want to change the whole code of the mother app
//------------------------------------------------------------------------------------------------------------------------------------------------------
exports.append = function (value) {
    ESCPOS_RESULT = ESCPOS_RESULT + value;
}
//=======================================================================================================================================================

//=======================================================================================================================================================
//ESCPOS_PRINT (thats what is all about *fg)
// Parameter:
//the  printername which you can get out of the printer list array exports.ESCPOS_PRINTERLIST after initialization
// What is printed is the current content of ESCPOS_RESULT
// only change is the correction of the character Code for the Currency symbol
//--------------------------------------------------------------------------------------------------------------------------------------------------------
// Printing is understood as a one way process in this context, and will simply copy a raw (.prt) File to the printer(queue)
// no check if the printer is online or offline or whether it really is a raw printer
// only errorcheck by result of copy operation
// sucess means the os has copied the file
//-------------------------------------------------------------------------------------------------------------------------------------------------------
exports.ESCPOS_PRINT = function(printername) {
// we use tempdir as it should be available and read/writeble in all Systems
var tempdir = operatingSys.tmpdir();
var filename = tempdir + "/escpos.prt";
//needed for linux printing
var printcommand = ""; 
var printresult = "";
var foundprinter = false;
        for (p=0;p<exports.ESCPOS_PRINTERLIST.length;p++) {
                if (exports.ESCPOS_PRINTERLIST[p]==printername) {
                        foundprinter = true;
                }
        }

        if (!foundprinter) {
            exports.ESCPOS_LASTERROR = "Printer "+printername+" not found";
            return false;
        }

// delete the last version of our RAW file
        try {
                stats = fileSys.lstatSync(filename);
                if (stats.isFile()) {
                    fileSys.unlinkSync(filename);
                }
        }
        catch (e) {
            // why bother deleting if the file does not even exist
        }
// manual correction for the currency Symbol in my case the Euro Sign:
        ESCPOS_RESULT = ESCPOS_RESULT.replace("€",String.fromCharCode(128));
// and just in case you forgot it add a final printit/newline
        ESCPOS_RESULT = ESCPOS_RESULT + String.fromCharCode(10);
// write our content to the RAW printer file    
        fileSys.appendFileSync(filename, ESCPOS_RESULT,'binary');

//We are more or less printed so reinitialize our result string
        ESCPOS_RESULT = "";
        

// finally use OS specific method to copy to printer or print it via cups lp implementation
// Windows needs try catch , while cups delivers a result anyway
        if (OS=="WIN") {
            try{
                fileSys.writeFileSync('//localhost/'+printername, fileSys.readFileSync(filename));
                exports.ESCPOS_LASTERROR = "data printed";
                return true
            }
            catch(e) {
                exports.ESCPOS_LASTERROR = "Error copying prt file : "+e.message;
                return false;
            }
        }

        if (OS=="LINUX") {
            printcommand = "lp -d " + printername +" "+filename;            
            exports.ESCPOS_LASTERROR =  doIt( printcommand,{encoding:'UTF-8'});
            if (exports.ESCPOS_LASTERROR.indexOf("not found")>-1) {
                return false;
            }else{
                return true;
            }
        }
    
}
//=======================================================================================================================================================



//=====================================================================================================================================
// Various Commandsets named appropriately for easy use
exports.ESCPOS_CMD = {
        RESET: new Buffer('1B40','hex').toString('utf8'),
        FONTA: new Buffer('1B4D00','hex').toString('utf8'),
        FONTB: new Buffer('1B4D01','hex').toString('utf8'),
        NORMAL: new Buffer('1B4500','hex').toString('utf8'),
        BOLD: new Buffer('1B4501','hex').toString('utf8'),
        NOUNDERLINE: new Buffer('1B2D00','hex').toString('utf8'),
        THINUNDERLINE: new Buffer('1B2D01','hex').toString('utf8'),
        THICKUNDERLINE: new Buffer('1B2D02','hex').toString('utf8'),
        SETSIZE: function(width,height){
                var command = new Buffer('1D21'+("00"+((width-1)*16)+(height-1).toString(16)).slice(-2),'hex').toString('utf8');
                return command
        },
        SMOOTH_ON: new Buffer('1D62FF','hex').toString('utf8'),
        SMOOTH_OFF: new Buffer('1D6200','hex').toString('utf8'),
        DOUBLE_ON: new Buffer('1B4701','hex').toString('utf8'),
        DOUBLE_OFF: new Buffer('1B4700','hex').toString('utf8'),
        UPSDOWN_ON: new Buffer('1B7B01','hex').toString('utf8'),
        UPSDOWN_OFF: new Buffer('1B7B00','hex').toString('utf8'),
        TURN90_ON: new Buffer('1B5601','hex').toString('utf8'),
        TURN90_OFF: new Buffer('1B5600','hex').toString('utf8'),
        INVERT_ON: new Buffer('1D4201','hex').toString('utf8'),
        INVERT_OFF: new Buffer('1D4200','hex').toString('utf8'),
        LEFT: new Buffer('1B6100','hex').toString('utf8'),
        CENTER: new Buffer('1B6101','hex').toString('utf8'),
        RIGHT: new Buffer('1B6102','hex').toString('utf8'),
        // mere cutting command will cut paper in the middle of your text due to different positions of print- and cuthead
        // looks like not all printers support different cutting modes        
        CUT_FULL: new Buffer('1D564100','hex').toString('utf8'),
        CUT_PARTIAL: new Buffer('1D564200','hex').toString('utf8'),
        // feed x motionunits and cut
        FEEDCUT_FULL: function(units){
                command = new Buffer('1D5641'+("00"+units.toString(16)).slice(-2),'hex').toString('utf8');
                return command
                },
        FEEDCUT_PARTIAL: function(units){
                command = new Buffer('1D5642'+("00"+units.toString(16)).slice(-2),'hex').toString('utf8');
                return command
                },
        FEEDUNITS_ANDPRINT: function(units){
                var command = new Buffer('1B4A'+("00"+units.toString(16)).slice(-2),'hex').toString('utf8');
                return command;
        },
        FEEDLINES_ANDPRINT: function(units){
                var command = new Buffer('1B64'+("00"+units.toString(16)).slice(-2),'hex').toString('utf8');
                return command;
        },
        // not supported by all printers
        PRINT_GOBACK: function(units){
                var command = new Buffer('1B65'+("00"+units.toString(16)).slice(-2),'hex').toString('utf8');
                return command;
        },
        RIGHT_SPACE: function(units){
                var command = new Buffer('1B20'+("00"+units.toString(16)).slice(-2),'hex').toString('utf8');
                return command;
        },
        LINE_SPACE: function(units){
                var command = new Buffer('1B33'+("00"+units.toString(16)).slice(-2),'hex').toString('utf8');
                return command;
        },
        LINE_SPACE_DEFAULT: new Buffer('1B32','hex').toString('utf8')
        
}
//=====================================================================================================================================

//=====================================================================================================================================
//ESCPOS_IMAGEFILE
// Delivers a well formatted ESCPOS String containing all necessary command and the image data from a given fully qualified filename jpg,bmp,gif,svg supported
//-------------------------------------------------------------------------------------------------------------------------------------
// Parameters are the following
// mothetcontext : VERY IMPORTANT !! here you have to supply the calling functions Browser-context window (this.window)
//      this is necessary to be able to create an image and a canvas to draw on, even if they are not visible
// FILENAME: STRING fully qualified name of the image file ( Dimensions should fit the max printer width)
// IMGMODE: INTEGER really only 33 makes sense as it wont strech the image in one or the other direction
//      0: 8 dots single density ×2 horizontal ×3 vertical
//      1: 8 dots double density ×1 horizontal ×3 vertical
//      32: 24 dots single density ×2 horizontal×1 vertical
//      33: 24 dots double density ×1 horizontal×1 vertical
//DITHER: BOOLEAN wheather or not to dither (convert to quasi grayscale )the image
//IMGTHRESHOLD: INTEGER (1 to255 practical value is 127) used for simple b/w decision and as a threshold in the dithering part
//-------------------------------------------------------------------------------------------------------------------------------------

exports.ESCPOS_IMAGEFILE = function (mothercontext,ESCPOS_FILENAME,ESCPOS_IMGMODE,ESCPOS_DITHER,ESCPOS_IMGTHRESHOLD) {

// as we are dealing with a canvas we need to prefix it with the correspondant mime-string
var ESCPOS_extension = ESCPOS_FILENAME.substr(ESCPOS_FILENAME.lastIndexOf('.')+1)
switch (ESCPOS_extension.toUpperCase()) {
    case "JPG" :
        var ESCPOS_mimestring = "data:image/jpeg;base64,";
        break;
    case "JPEG" :
        var ESCPOS_mimestring = "data:image/jpeg;base64,";
        break;
    case "BMP" :
        var ESCPOS_mimestring = "data:image/bmp;base64,";
        break;
    case "GIF" :
        var ESCPOS_mimestring = "data:image/gif;base64,";
        break;
    case "PNG" :
        var ESCPOS_mimestring = "data:image/png;base64,";
        break;
    case "SVG" :
        var ESCPOS_mimestring = "data:image/svg+xml;base64,";
        break;
    default :
        var ESCPOS_mimestring = "data:image/jpeg;base64,";
}        
// now we load the file synchronously !!! and draw it to an canvas of the calling i.e. mother context
var ESCPOS_imagesource = new mothercontext.Image();
        ESCPOS_imagesource.src = ESCPOS_mimestring + fileSys.readFileSync(ESCPOS_FILENAME).toString("base64");
var ESCPOS_canvas = mothercontext.document.createElement('canvas');
        ESCPOS_canvas.setAttribute('width', ESCPOS_imagesource.width);
        ESCPOS_canvas.setAttribute('height', ESCPOS_imagesource.height);
var ESCPOS_context = ESCPOS_canvas.getContext('2d');
        ESCPOS_context.drawImage(ESCPOS_imagesource,0,0);         

// for the actual processing we need to split the image into lines of the given ( 8 or 24 pixels) height i.e. vertical slizesize
// all the fuss is necessary because imagedata from canvas is supplied in rows of single pixels
// so we need to iterate properly

// holds the canvas data transfered into pixel color information
var ESCPOS_imagedata = "";
// a simple representation of black or white info in a zero or one based string representing one or three bytes
var ESCPOS_bytestring = "";
// the b/w data for one printhead movement
var ESCPOS_onelinedata ="";
// this helps us to move to the right pixel information as the color information has other sequence than we need
var ESCPOS_pixeldataoffset = 0;
// by this we make the decision to print black or white pixels
// dont worry about the same variable used for dithering
// if you first dither its more or less irrelevant because the dithered image already contains only b/w pixels which wil be calculated right alsmost no matter what is used
var ESCPOS_pixeltreshold = ESCPOS_IMGTHRESHOLD;
// what we want to produce
var ESCPOS_output = "";

//create the appropriate command and set the line height (internal parameter)  in pixels;
switch (ESCPOS_IMGMODE) {
    case 0:
        var ESCPOS_verticalslicesize = 8;
        var ESCPOS_modepraefix = '00';
        break;
    case 1:
        var ESCPOS_verticalslicesize = 8;
        ESCPOS_modepraefix = '01';
        break;
    case 32:
        var ESCPOS_verticalslicesize = 24;
        var ESCPOS_modepraefix = '20';
        break;
    case 33:
        var ESCPOS_verticalslicesize = 24;
        var ESCPOS_modepraefix = '21';
        break;
    default:
        var ESCPOS_verticalslicesize = 24;
        var ESCPOS_modepraefix = '21';
}
// calculate hibyte and lowbyte as hex starings
var ESCPOS_HHSTRING = ("00"+ Math.floor(ESCPOS_canvas.width/256).toString(16)).slice(-2);
var ESCPOS_HLSTRING = ("00"+ Math.floor(ESCPOS_canvas.width%256).toString(16)).slice(-2);

// the actual printig command which needs to be filled with parameters for every pass
var ESCPOS_imagepraefix = new Buffer('1B2A'+ESCPOS_modepraefix+ESCPOS_HLSTRING+ESCPOS_HHSTRING,'hex');

// calculate how many rows we need for the given image rounded up so we dont loose any anformation but fill up with white space
var ESCPOS_linecount = Math.ceil(ESCPOS_canvas.height/ESCPOS_verticalslicesize)
// create a (hex) Buffer which will hold exactly one vertical line of printer dots in x bytes
var ESCPOS_pixeldata = new Buffer(ESCPOS_verticalslicesize/8);

// now we transfer the canvas data into an array containing four values per pixel i.e. the color information
ESCPOS_imagedata = ESCPOS_context.getImageData(0, 0, ESCPOS_canvas.width,ESCPOS_canvas.height );
// on that array we might apply the dithering algorithm
if (ESCPOS_DITHER) {
        ESCPOS_imagedata = monochrome(ESCPOS_imagedata,ESCPOS_IMGTHRESHOLD,"");
}
// outer iteration is one line of 8 or 24 pixels of the image (printhead movement )
for(var lines = 0;lines < ESCPOS_linecount; lines++){
                ESCPOS_onelinedata = ESCPOS_imagepraefix.toString('binary');
                // finally evaluate the pixel values vor every 8 or 24 pixel column of  127 or less columns
                for ( var pixelcolumn = 0 ; pixelcolumn< ESCPOS_imagesource.width; pixelcolumn ++) {
                        // each pixels evaluation end up in a 0 or 1 literal
                        ESCPOS_bytestring = "";
                        // iterate through a single (of 127 or less ) column of 8 or 24 pixels
                        for(var zeile = 0; zeile < ESCPOS_verticalslicesize; zeile++){
                                // one ugly line of code to evaluate the pixel data i.e. use a standard algorithm to decide black or white from the first three pixel color informations
                                // comparing them to the threshold value and converting it to a 0 or 1 literal
                                //adding that one to the bytestring initialized before the loop
                                ESCPOS_bytestring = ESCPOS_bytestring + ((((ESCPOS_imagedata.data[ESCPOS_pixeldataoffset]*0.3) + (ESCPOS_imagedata.data[ESCPOS_pixeldataoffset+1]*0.59)+(ESCPOS_imagedata.data[ESCPOS_pixeldataoffset+2]*0.11))< ESCPOS_pixeltreshold)*1).toString();
                                // a few lines more but better readable to do just the same
                                //BlackOrWhite = (imgData.data[ESCPOS_pixeldataoffset]*0.3) + (imgData.data[ESCPOS_pixeldataoffset+1]*0.59)+(imgData.data[ESCPOS_pixeldataoffset+2]*0.11);
                                //if (BlackOrWhite < ESCPOS_pixeltreshold) {
                                //    ESCPOS_bytestring = ESCPOS_bytestring +"1";
                                //}else{
                                //    ESCPOS_bytestring = ESCPOS_bytestring+ "0";
                                //}
                                
                                // VERY IMPORTANT
                                // if we advance one times the full width multiplied by 4 ( remember each pixel has four colour values in the image data)
                                // we get exactly to the position of the pixel below the last one
                                ESCPOS_pixeldataoffset = ESCPOS_pixeldataoffset + (ESCPOS_canvas.width*4)
                        }
                        // finally convert our bitwise literals into bytes
                        //if we are in 8 pixel mode one byte is enough
                        ESCPOS_pixeldata[0] = parseInt(ESCPOS_bytestring.substring(0,7),2);
                        // if we process 24 pixels we need three bytes and have initialized the buffer to 3 instead of 1
                        if (ESCPOS_pixeldata.length>1) {
                                ESCPOS_pixeldata[1] = parseInt(ESCPOS_bytestring.substring(8,15),2);
                                ESCPOS_pixeldata[2] = parseInt(ESCPOS_bytestring.substring(16,23),2);
                        }

                        // add this column of pixels to the line result string
                        ESCPOS_onelinedata = ESCPOS_onelinedata + ESCPOS_pixeldata.toString('ascii');
                        // now we have to move back the whole way minus one pixel to get to the top of the next column
                        ESCPOS_pixeldataoffset = ESCPOS_pixeldataoffset -((ESCPOS_canvas.width*4*ESCPOS_verticalslicesize)-4);
                }
                // add the single line result to the general result
                ESCPOS_output = ESCPOS_output + ESCPOS_onelinedata;
        // we are done with what ?  one line of printer data so we need to tell the printer to print and go to the next line
        ESCPOS_output = ESCPOS_output + String.fromCharCode(10);
        // as we already moved back to the next, but not to be processed pixel( as it would not be the next column in the row )
        // we move foreward one full line of data i.e. one pixelrow (width * 4) * lines in a line
        ESCPOS_pixeldataoffset = ESCPOS_pixeldataoffset+(ESCPOS_canvas.width*4*ESCPOS_verticalslicesize); 
}


return ESCPOS_output;
        
}
//=====================================================================================================================================

//=======================================================================================================================================================
// monochrome only used internally (called by ESCPOS_IMAGEFILE )
// Dithering image data
// thanks to http://meemoo.org
// http://stackoverflow.com/questions/12422407/monochrome-dithering-in-javascript-bayer-atkinson-floyd-steinberg
//-------------------------------------------------------------------------------------------------------------------------------------------------------
// I use an empty value for the type parameter which makes use of  Bill Atkinson's dithering algorithm which made best results with my test images
// If you want to use different ones you have to adopt the function call
// using "none" doesnt make sense because the default b/w decision is included in  ESCPOS_IMAGEFILE
//-------------------------------------------------------------------------------------------------------------------------------------------------------

function monochrome(imageData, threshold, type){

var bayerThresholdMap = [
  [  15, 135,  45, 165 ],
  [ 195,  75, 225, 105 ],
  [  60, 180,  30, 150 ],
  [ 240, 120, 210,  90 ]
];

var lumR = [];
var lumG = [];
var lumB = [];
for (var i=0; i<256; i++) {
  lumR[i] = i*0.299;
  lumG[i] = i*0.587;
  lumB[i] = i*0.114;
}

  var imageDataLength = imageData.data.length;

  // Greyscale luminance (sets r pixels to luminance of rgb)
  for (var i = 0; i <= imageDataLength; i += 4) {
    imageData.data[i] = Math.floor(lumR[imageData.data[i]] + lumG[imageData.data[i+1]] + lumB[imageData.data[i+2]]);
  }

  var w = imageData.width;
  var newPixel, err;

  for (var currentPixel = 0; currentPixel <= imageDataLength; currentPixel+=4) {

    if (type === "none") {
      // No dithering
      imageData.data[currentPixel] = imageData.data[currentPixel] < threshold ? 0 : 255;
    } else if (type === "bayer") {
      // 4x4 Bayer ordered dithering algorithm
      var x = currentPixel/4 % w;
      var y = Math.floor(currentPixel/4 / w);
      var map = Math.floor( (imageData.data[currentPixel] + bayerThresholdMap[x%4][y%4]) / 2 );
      imageData.data[currentPixel] = (map < threshold) ? 0 : 255;
    } else if (type === "floydsteinberg") {
      // Floyd–Steinberg dithering algorithm
      newPixel = imageData.data[currentPixel] < 129 ? 0 : 255;
      err = Math.floor((imageData.data[currentPixel] - newPixel) / 16);
      imageData.data[currentPixel] = newPixel;

      imageData.data[currentPixel       + 4 ] += err*7;
      imageData.data[currentPixel + 4*w - 4 ] += err*3;
      imageData.data[currentPixel + 4*w     ] += err*5;
      imageData.data[currentPixel + 4*w + 4 ] += err*1;
    } else {
      // Bill Atkinson's dithering algorithm
      newPixel = imageData.data[currentPixel] < threshold ? 0 : 255;
      err = Math.floor((imageData.data[currentPixel] - newPixel) / 8);
      imageData.data[currentPixel] = newPixel;

      imageData.data[currentPixel       + 4 ] += err;
      imageData.data[currentPixel       + 8 ] += err;
      imageData.data[currentPixel + 4*w - 4 ] += err;
      imageData.data[currentPixel + 4*w     ] += err;
      imageData.data[currentPixel + 4*w + 4 ] += err;
      imageData.data[currentPixel + 8*w     ] += err;
    }

    // Set g and b pixels equal to r
    imageData.data[currentPixel + 1] = imageData.data[currentPixel + 2] = imageData.data[currentPixel];
  }

  return imageData;
}
// thanks to http://meemoo.org
// http://stackoverflow.com/questions/12422407/monochrome-dithering-in-javascript-bayer-atkinson-floyd-steinberg
//=======================================================================================================================================================


//=====================================================================================================================================
//ESCPOS_BARCODE
// Deliveres a well formatted string containing commands and barcode data
//-------------------------------------------------------------------------------------------------------------------------------------
// Parameters as follows
// BARCONTENT: STRING self expaining, but what is acceptes depends on the code type ( Aplphanumeric or numeric only ,  number of characters )
// BARTYPE: INTEGER 65: UPC-A 66: UPC-B  67: EAN-13 68: EAN-8 69: Code39 70: Interleaved 2of5  71: Codabar 72: Code-39 73: Code-128 74: UCC/Ean-128
// BARWIDTH: INTEGER range 2 to 6
// BARHEIGHT: INTEGER range 1 to 255 (dots)
// HRFONT 0 for Printerfont A, 1 for Printerfont B
// HRIPOSITION INTEGER 0: not printed , 1: above Code, 2: below Code, 3 above and below
//-------------------------------------------------------------------------------------------------------------------------------------
exports.ESCPOS_BARCODE = function barcode(ESCPOS_BARCONTENT,ESCPOS_BARTYPE,ESCPOS_BARWIDTH,ESCPOS_BARHEIGHT,ESCPOS_HRIFONT,ESCPOS_HRIPOSITION) {
var output = "";
var parametercommands = new Buffer(12);
//barcode Height
parametercommands[0]='0x1D';
parametercommands[1]='0x68';
parametercommands[2]=ESCPOS_BARHEIGHT;
// barcode width
parametercommands[3]='0x1D';
parametercommands[4]='0x77';
parametercommands[5]=ESCPOS_BARWIDTH;
//Human readable charcters size
parametercommands[6]='0x1D';
parametercommands[7]='0x66';
parametercommands[8]=ESCPOS_HRIFONT;
// human readable position 
parametercommands[9]='0x1D';
parametercommands[10]='0x48';
parametercommands[11]=ESCPOS_HRIPOSITION;

var printcommand = new Buffer(4);
printcommand[0] = '0x1D';
printcommand[1] = '0x6B';
//codetyp
printcommand[2] = ESCPOS_BARTYPE;
printcommand[3] = ESCPOS_BARCONTENT.length;

output = parametercommands.toString('utf8')+printcommand.toString('utf8')+ESCPOS_BARCONTENT+String.fromCharCode(10);
return output;
}
//=====================================================================================================================================

//=====================================================================================================================================
//ESCPOS_QRCODE
// Delivers a well formatted ESCPOS String containing all necessary command and content information for QR Codes
// Thanks to http://stackoverflow.com/users/1599609/josue-ibarra
// Answers section of : http://stackoverflow.com/questions/23577702/printing-qr-codes-through-an-esc-pos-thermal-printer
//-------------------------------------------------------------------------------------------------------------------------------------
// Parameters as follows
// QRDATA STRING ---self explaining
// QRMODEL INTEGER 49: Model 1 , 50: Model 2 , 51: Micro QR
// QRSIZE: INTEGER 1 - 16 depends on Printer up to which size this will work default in ESCPOS is 3
// QRERRORC: INTEGER 48: 7%, 49: 15% , 50: 25%, 51: 30% 
//-------------------------------------------------------------------------------------------------------------------------------------
exports.ESCPOS_QRCODE = function (ESCPOS_QRDATA,ESCPOS_QRMODEL,ESCPOS_QRSIZE, ESCPOS_QRERRORC){
var output = "";
var store_len = ESCPOS_QRDATA.length+ 3;
var sizebytes = new Buffer(2);
sizebytes[0] = store_len % 256 ;
sizebytes[1] = store_len / 256;

    // QR Code: Select the model
    //              Hex     1D      28      6B      04      00      31      41      n1(x32)     n2(x00) - size of model
    // set n1 [49 x31, model 1] [50 x32, model 2] [51 x33, micro qr code]
    // https://reference.epson-biz.com/modules/ref_escpos/index.php?content_id=140
    var modelQR = new Buffer('1d286b04003141'+("00"+ESCPOS_QRMODEL.toString(16)).slice(-2)+'00','hex');  
    
    // QR Code: Set the size of module
    // Hex      1D      28      6B      03      00      31      43      n
    // n depends on the printer
    // https://reference.epson-biz.com/modules/ref_escpos/index.php?content_id=141
    var sizeQR = new Buffer('1d286b03003143'+("00"+ESCPOS_QRSIZE.toString(16)).slice(-2),'hex');

    // QR Code: Set the errorcorrection level    //          Hex     1D      28      6B      03      00      31      45      n
    // Set n for error correction [48 x30 -> 7%] [49 x31-> 15%] [50 x32 -> 25%] [51 x33 -> 30%]
    // https://reference.epson-biz.com/modules/ref_escpos/index.php?content_id=142
    var errorQR = new Buffer('1d286b03003145'+("00"+ESCPOS_QRERRORC.toString(16)).slice(-2),'hex');
    
    
    // QR Code: Store the data in the symbol storage area
    // Hex      1D      28      6B      pL      pH      31      50      30      d1...dk
    // https://reference.epson-biz.com/modules/ref_escpos/index.php?content_id=143
    //                        1D          28          6B         pL          pH  cn(49->x31) fn(80->x50) m(48->x30) d1…dk
    
    //needed to do this in three parts to include the appropriate two bites with the length information
    var storeQR1 = new Buffer('1d286b','hex');
    var storeQR2 = new Buffer('315030','hex');
    var storeQR = storeQR1.toString('ascii')+sizebytes.toString('ascii')+storeQR2.toString('ascii');
    
    // QR Code: Print the symbol data in the symbol storage area
    // Hex      1D      28      6B      03      00      31      51      m
    // https://reference.epson-biz.com/modules/ref_escpos/index.php?content_id=144
    var printQR = new Buffer('1d286b0300315130','hex');
    
     output = output + modelQR.toString('utf8');   
     output = output + sizeQR.toString('utf8');   
     output = output + errorQR.toString('utf8');
     output = output + storeQR;
     //output = output + ESCPOS_QRDATA;
     output = output + new Buffer(ESCPOS_QRDATA,'binary').toString('utf8');
     output = output + printQR.toString('utf8');
     //output = output + String.fromCharCode(10);

return output;
}
// Thanks to http://stackoverflow.com/users/1599609/josue-ibarra
// Answers section of : http://stackoverflow.com/questions/23577702/printing-qr-codes-through-an-esc-pos-thermal-printer
//=====================================================================================================================================

//=====================================================================================================================================
// Named Constants for selecting the characterset
// had to tryout a lot to get the right characterset and codepage settings for my printer and language
//-------------------------------------------------------------------------------------------------------------------------------------
exports.ESCPOS_CHARSET = {
        USA: new Buffer('1B5200','hex').toString('utf8'),
        FRANCE: new Buffer('1B5201','hex').toString('utf8'),
        GERMANY: new Buffer('1B5202','hex').toString('utf8'),
        UK: new Buffer('1B5203','hex').toString('utf8'),
        DENMK_1: new Buffer('1B5204','hex').toString('utf8'),
        SWEDEN: new Buffer('1B5205','hex').toString('utf8'),
        ITALY: new Buffer('1B5206','hex').toString('utf8'),
        SPAIN_1: new Buffer('1B5207','hex').toString('utf8'),
        JAPAN: new Buffer('1B5208','hex').toString('utf8'),
        NORWAY: new Buffer('1B5209','hex').toString('utf8'),
        DENMK_2: new Buffer('1B520A','hex').toString('utf8'),
        SPAIN_2: new Buffer('1B520B','hex').toString('utf8'),
        LATINAMERICA: new Buffer('1B520C','hex').toString('utf8'),
        KOREAN: new Buffer('1B520D','hex').toString('utf8'),
        SLOVENIA_CROATIA: new Buffer('1B520E','hex').toString('utf8'),
        CHINA: new Buffer('1B520F','hex').toString('utf8'),
        VIETNAM: new Buffer('1B5210','hex').toString('utf8'),
        ARABIA: new Buffer('1B5211','hex').toString('utf8')
}
//=====================================================================================================================================

//=====================================================================================================================================
// Function to select Codepage by Number
// i.e. if You know your printers understanding of the "Ecc J"  Parameter
// had to tryout a lot to get the right characterset and codepage settings for my printer and language
//-------------------------------------------------------------------------------------------------------------------------------------
exports.ESCPOS_CPBYNUMBER = function(pagenumber) {
        return   new Buffer ('1B74'+("00"+pagenumber.toString(16)).slice(-2),'hex').toString('utf8');
}
//=====================================================================================================================================



//=====================================================================================================================================
// Named Constants for selecting the codepages as defined by EPSON using the standard ESCPOS Command
// had to tryout a lot to get the right characterset and codepage settings for my printer and language
//-------------------------------------------------------------------------------------------------------------------------------------
exports.ESCPOS_CP_EPSON = {
        USA_437 : exports.ESCPOS_CPBYNUMBER(0),
        KATAKANA : exports.ESCPOS_CPBYNUMBER(1),
        MULTILINGUAL_850 : exports.ESCPOS_CPBYNUMBER(2),
        PORTUGUESE_860 : exports.ESCPOS_CPBYNUMBER(3),
        CANADIANFRENCH_863 : exports.ESCPOS_CPBYNUMBER(4),
        NORDIC_865 : exports.ESCPOS_CPBYNUMBER(5),
        SIPLIFIEDKANJI_HIRAKANA : exports.ESCPOS_CPBYNUMBER(6),
        SIPLIFIEDKANJI_II : exports.ESCPOS_CPBYNUMBER(7),
        SIPLIFIEDKANJI_III : exports.ESCPOS_CPBYNUMBER(8),
        LATINI_1252 : exports.ESCPOS_CPBYNUMBER(16),
        CYRILLIC2_866 : exports.ESCPOS_CPBYNUMBER(17),
        LATINII_852 : exports.ESCPOS_CPBYNUMBER(18),
        EURO_858 : exports.ESCPOS_CPBYNUMBER(19),
        HEBREW_862 : exports.ESCPOS_CPBYNUMBER(21),
        ARABIC_864 : exports.ESCPOS_CPBYNUMBER(22),
        THAI_42 : exports.ESCPOS_CPBYNUMBER(23),
        GREEK_1253 : exports.ESCPOS_CPBYNUMBER(24),
        TURKISH_1254 : exports.ESCPOS_CPBYNUMBER(25),
        BALTIC_1257 : exports.ESCPOS_CPBYNUMBER(26),
        FARSI : exports.ESCPOS_CPBYNUMBER(27),
        CYRILLIC_1251 : exports.ESCPOS_CPBYNUMBER(28),
        GREEK_737 : exports.ESCPOS_CPBYNUMBER(29),
        BALTIC_775 : exports.ESCPOS_CPBYNUMBER(30),
        THAI_14 : exports.ESCPOS_CPBYNUMBER(31),
        HEBREWNEW_1255 : exports.ESCPOS_CPBYNUMBER(33),
        THAI11 : exports.ESCPOS_CPBYNUMBER(34),
        THAI8 : exports.ESCPOS_CPBYNUMBER(35),
        CYRILLIC_855 : exports.ESCPOS_CPBYNUMBER(36),
        TURKISH_857 : exports.ESCPOS_CPBYNUMBER(37),
        GREEK_928 : exports.ESCPOS_CPBYNUMBER(38),
        THAI_16 : exports.ESCPOS_CPBYNUMBER(39),
        ARABIC_1256 : exports.ESCPOS_CPBYNUMBER(40),
        VIETNAM_1258 : exports.ESCPOS_CPBYNUMBER(41),
        KHMER : exports.ESCPOS_CPBYNUMBER(42),
        CZECH_1250 : exports.ESCPOS_CPBYNUMBER(47)
}
//=====================================================================================================================================

//=====================================================================================================================================
// Named Constants for selecting the codepages as defined by STAR using the standard ESCPOS Command
// had to tryout a lot to get the right characterset and codepage settings for my printer and language
//-------------------------------------------------------------------------------------------------------------------------------------
exports.ESCPOS_CP_STAR = {
        USA_437 : exports.ESCPOS_CPBYNUMBER(0),
        KATAKANA : exports.ESCPOS_CPBYNUMBER(1),
        MULTILINGUAL_850 : exports.ESCPOS_CPBYNUMBER(2),
        PORTUGUESE_860 : exports.ESCPOS_CPBYNUMBER(3),
        CANADIANFRENCH_863 : exports.ESCPOS_CPBYNUMBER(4),
        NORDIC_865 : exports.ESCPOS_CPBYNUMBER(5),
        LATINI_1252 : exports.ESCPOS_CPBYNUMBER(16),
        CYRILLIC2_866 : exports.ESCPOS_CPBYNUMBER(17),
        LATINII_852 : exports.ESCPOS_CPBYNUMBER(18),
        EURO_858 : exports.ESCPOS_CPBYNUMBER(19),
        THAICC_42 : exports.ESCPOS_CPBYNUMBER(20),
        THAICC_11 : exports.ESCPOS_CPBYNUMBER(21),
        THAICC_13 : exports.ESCPOS_CPBYNUMBER(22),
        THAICC_14 : exports.ESCPOS_CPBYNUMBER(23),
        THAICC_16 : exports.ESCPOS_CPBYNUMBER(24),
        THAICC_17 : exports.ESCPOS_CPBYNUMBER(25),
        THAICC_18 : exports.ESCPOS_CPBYNUMBER(26)
}
//=====================================================================================================================================

//=====================================================================================================================================
// Named Constants for selecting the codepages as defined by STAR using the SPECIAL COMMAND for STAR PRINTERS (only?) 
// had to tryout a lot to get the right characterset and codepage settings for my printer and language
//-------------------------------------------------------------------------------------------------------------------------------------
exports.STAR_CP ={       
        Default : new Buffer('1B1D7400','hex').toString('utf8'),
        USA_437 : new Buffer('1B1D7401','hex').toString('utf8'),
        Katakana : new Buffer('1B1D7402','hex').toString('utf8'),
        StdEurope_437 : new Buffer('1B1D7403','hex').toString('utf8'),
        Multilingual_858 : new Buffer('1B1D7404','hex').toString('utf8'),
        Latin2_852 : new Buffer('1B1D7405','hex').toString('utf8'),
        Portuguese_860 : new Buffer('1B1D7406','hex').toString('utf8'),
        Icelandic_861 : new Buffer('1B1D7407','hex').toString('utf8'),
        CanadianFrench_863 : new Buffer('1B1D7408','hex').toString('utf8'),
        Nordic_865 : new Buffer('1B1D7409','hex').toString('utf8'),
        CyrillicRussian_866 : new Buffer('1B1D740A','hex').toString('utf8'),
        CyrillicBulgarian_855 : new Buffer('1B1D740B','hex').toString('utf8'),
        Turkish_857 : new Buffer('1B1D740C','hex').toString('utf8'),
        Hebrew_862 : new Buffer('1B1D740D','hex').toString('utf8'),
        Arabic_864 : new Buffer('1B1D740E','hex').toString('utf8'),
        Greek_737 : new Buffer('1B1D740F','hex').toString('utf8'),
        Greek_851 : new Buffer('1B1D7410','hex').toString('utf8'),
        Greek_869 : new Buffer('1B1D7411','hex').toString('utf8'),
        Greek_928 : new Buffer('1B1D7412','hex').toString('utf8'),
        Lithuanian_772 : new Buffer('1B1D7413','hex').toString('utf8'),
        Lithuanian_774 : new Buffer('1B1D7414','hex').toString('utf8'),
        Thai_874 : new Buffer('1B1D7415','hex').toString('utf8'),
        WindowsLatin1_1252 : new Buffer('1B1D7420','hex').toString('utf8'),
        WindowsLatin2_1250 : new Buffer('1B1D7421','hex').toString('utf8'),
        WindowsCyrillic_1251 : new Buffer('1B1D7422','hex').toString('utf8'),
        IBMRussian_3840 : new Buffer('1B1D7440','hex').toString('utf8'),
        Gost_3841 : new Buffer('1B1D7441','hex').toString('utf8'),
        Polish_3843 : new Buffer('1B1D7442','hex').toString('utf8'),
        CS2_3844 : new Buffer('1B1D7443','hex').toString('utf8'),
        Hungarian_3845 : new Buffer('1B1D7444','hex').toString('utf8'),
        Turkish_3846 : new Buffer('1B1D7445','hex').toString('utf8'),
        BrazilABNT_3847 : new Buffer('1B1D7446','hex').toString('utf8'),
        BrazilABICOMP_3848 : new Buffer('1B1D7447','hex').toString('utf8'),
        Arabic_1001 : new Buffer('1B1D7448','hex').toString('utf8'),
        LithuanianKBL_2001 : new Buffer('1B1D7449','hex').toString('utf8'),
        Estonian1_3001 : new Buffer('1B1D744A','hex').toString('utf8'),
        Estonian2_3002 : new Buffer('1B1D744B','hex').toString('utf8'),
        Latvian1_3011 : new Buffer('1B1D744C','hex').toString('utf8'),
        Latvian2_3012 : new Buffer('1B1D744D','hex').toString('utf8'),
        Bulgarian_3021 : new Buffer('1B1D744E','hex').toString('utf8'),
        Maltese_3041 : new Buffer('1B1D744F','hex').toString('utf8'),      
        Thai_CC42 : new Buffer('1B1D7460','hex').toString('utf8'),
        Thai_CC11 : new Buffer('1B1D7461','hex').toString('utf8'),
        Thai_CC13 : new Buffer('1B1D7462','hex').toString('utf8'),
        Thai_CC14 : new Buffer('1B1D7463','hex').toString('utf8'),
        Thai_CC16 : new Buffer('1B1D7464','hex').toString('utf8'),
        Thai_CC17 : new Buffer('1B1D7465','hex').toString('utf8'),
        Thai_CC18 : new Buffer('1B1D7466','hex').toString('utf8')
}
//=====================================================================================================================================

//LICENSE =============================================================================================================================
//MIT License
//
//Copyright (c) [2016] [Thomas Höbelt]
//
//Permission is hereby granted, free of charge, to any person obtaining a copy
//of this software and associated documentation files (the "Software"), to deal
//in the Software without restriction, including without limitation the rights
//to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
//copies of the Software, and to permit persons to whom the Software is
//furnished to do so, subject to the following conditions:
//
//The above copyright notice and this permission notice shall be included in all
//copies or substantial portions of the Software.
//
//THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
//OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
//SOFTWARE.
//=====================================================================================================================================







