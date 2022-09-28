window.onscroll = function() { stickNavbar() };
window.onresize = function() { stickNavbar() };
window.ondeviceorientation = function() { stickNavbar() };

var navbar = document.getElementsByClassName( "navigation" ).item( 0 );

function stickNavbar() {
    var header = document.getElementsByClassName( "header" ).item( 0 );

    navbar.setAttribute("style","width: " + header.getBoundingClientRect().width + "px" );
    navbar.style.width = header.getBoundingClientRect().width + 'px';

    if( window.pageYOffset > header.getBoundingClientRect().height )
        navbar.classList.add( "fixed" )
    else
        navbar.classList.remove( "fixed" );
}