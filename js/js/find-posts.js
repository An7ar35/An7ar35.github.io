/* ·-----------------------------------------------------·
 * | Blogator-Extras::find-posts.js                      |
 * |                                                     |
 * | Author .......: An7ar35                             |
 * | Created ......: 08 June 2020                        |
 * | Edited last ..: 19 July 2021
 * | URL ..........: https://an7ar35.bitbucket.io/       |
 * | License ......: D.B.A.D.                            |
 * ·-----------------------------------------------------·
 *
 * JS script to load a Blogator generated JSON index file
 * and populate a searchable and auto-complete capable
 * data-structure for use with a search box.
 *
 * supports: article headings, tags, projects
 */

var   blogator           = blogator || {};
const BLOGATOR_JSON_PATH = "../index/index.json";


/* =========================================== CLASSES ========================================== */
/**
 * Grove Node constructor
 * @constructor
 */
Node = function() {
    this.child_nodes  = new Map();
    this.articles_src = [];
    this.tags_src     = [];
    this.project_src  = [];
}

/**
 * Grove data-structure constructor
 * @constructor
 */
Grove = function() {
    this.trees = new Map();
}

/**
 * Break apart a string into unique individual words
 * @param str String to break into words
 * @returns Array of unique words
 */
Grove.prototype.breakStr = function( str ) {
    let arr = ( str.valueOf().toLowerCase() ).split( /[\s-]+/ );

    arr.forEach( ( o, i, arr ) => {
        arr[i] = o.replace( /[,!?#"*;:{}()\[\]=\-_`~]/g, "" );
    } );

    return [ ...new Set( arr ) ]; //remove duplicates
}

/**
 * Adds a source to a node
 * @param src_ref  JSON source object for the word to be added
 * @param src_type JSON source type
 * @param node     Node in tree onto which to add the source
 */
Grove.prototype.addSource = function( src_ref, src_type, node ) {
    if( src_type === blogator.SRC_TYPE.article )
        node.articles_src.push( src_ref );
    if( src_type === blogator.SRC_TYPE.tag )
        node.tags_src.push( src_ref );
    if( src_type === blogator.SRC_TYPE.project )
        node.project_src.push( src_ref );
}

/**
 * Adds a word into a tree
 * @param src_ref  JSON source object for the word to be added
 * @param src_type JSON source type
 * @param word     Word string to add
 * @param node     Current node in tree
 */
Grove.prototype.addWord = function( src_ref, src_type, word, node ) {
    if( word === '' )
        return;

    const c = word.charAt( 0 );

    if( !node.child_nodes.has( c ) )
        node.child_nodes.set( c, new Node() );

    let next_node = node.child_nodes.get( c );

    if( word.length > 1 ) {
        this.addWord( src_ref, src_type, word.slice( 1 ), next_node );
    } else { //i.e.: last char in word
        this.addSource( src_ref, src_type, next_node );
    }
}

/**
 * Adds a word to the grove's data-structure
 * @param word     Word to add
 * @param src_ref  Word JSON object source
 * @param src_type JSON object source type
 */
Grove.prototype.addGroveTree = function( word, src_ref, src_type ) {
    if( word.length < 2 )
        return;

    const c = word.charAt( 0 );

    if( !this.trees.has( c ) )
        this.trees.set( c, new Node() );

    this.addWord( src_ref, src_type, word.slice( 1 ), this.trees.get( c ) );
}

/**
 * Adds an article to the grove data-structure
 * @param article_src JSON source object for the article
 */
Grove.prototype.addArticle = function( article_src ) {
    let words = new Set();

    this.breakStr( article_src["title"] ).forEach( ( word ) => {
        words.add( word );
    } );

    article_src["tags"].forEach( ( e ) => {
        this.breakStr( e ).forEach( ( word ) => {
            words.add( word );
        } );
    } );

    words.forEach( ( word ) => {
        this.addGroveTree( word, article_src, blogator.SRC_TYPE.article )
    } );
}

/**
 * Adds a tag to the grove data-structure
 * @param tag_src JSON source object for the tag
 */
Grove.prototype.addTag = function( tag_src ) {
    this.breakStr( tag_src["name"] ).forEach( ( word ) => {
        this.addGroveTree( word, tag_src, blogator.SRC_TYPE.tag )
    } );
}

/**
 * Adds a project to the grove data-structure
 * @param project_src JSON source object for the project
 */
Grove.prototype.addProject = function( project_src ) {
    let words = new Set();

    this.breakStr( project_src["name"] ).forEach( ( word ) => {
        words.add( word );
    } );

    project_src["tags"].forEach( ( e ) => {
        this.breakStr( e ).forEach( ( word ) => {
            words.add( word );
        } );
    } );

    project_src["meta"].forEach( ( e ) => {
        this.breakStr( e ).forEach( ( word ) => {
            words.add( word );
        } );
    } );

    words.forEach( ( word ) => {
        this.addGroveTree( word, project_src, blogator.SRC_TYPE.project );
    } );
}

/**
 * Search constructor
 * @constructor
 */
Search = function () {
    this.index_json  = null;
    this.index_grove = new Grove();
}

/**
 * Gather all matching JSON source at node
 * @param node     Node (or last letter of word)
 * @param articles Set to store Article JSON source objects
 * @param tags     Set to store Tag JSON source objects
 * @param projects Set to store Project JSON source objects
 */
Search.prototype.gatherNodeResults = function( node, articles, tags, projects ) {
    if( Array.isArray( node.articles_src ) && node.articles_src.length )
        node.articles_src.forEach( ( value ) => { articles.add( value ); } );

    if( Array.isArray( node.tags_src ) && node.tags_src.length )
        node.tags_src.forEach( ( value ) => { tags.add( value ); } );

    if( Array.isArray( node.project_src ) && node.project_src.length )
        node.project_src.forEach( ( value ) => { projects.add( value ); } );
}

/**
 * Accumulate possible matching JSON source object
 * @param node     Root of tree at current position
 * @param articles Set to store Article JSON source objects
 * @param tags     Set to store Tag JSON source objects
 * @param projects Set to store Project JSON source objects
 */
Search.prototype.accumulateResults = function( node, articles, tags, projects ) {
    this.gatherNodeResults( node, articles, tags, projects );

    node.child_nodes.forEach(
        ( value ) => { this.accumulateResults( value, articles, tags, projects ); }
    );
}

Search.prototype.getPartialResults = function( word, articles, tags, projects ) {
    if( this.index_grove.trees.has( word.charAt( 0 ) ) ) {

        let node = this.index_grove.trees.get( word.charAt( 0 ) );

        for( let i = 1; i < word.length; i++ ) {
            const c = word.charAt( i );

            if( node.child_nodes.has( c ) )
                node = node.child_nodes.get( c );
            else
                return;
        }

        this.accumulateResults( node, articles, tags, projects )
    }
}

Search.prototype.getExactResults = function( word, articles, tags, projects ) {
    if( this.index_grove.trees.has( word.charAt( 0 ) ) ) {

        let node = this.index_grove.trees.get( word.charAt( 0 ) );

        for( let i = 1; i < word.length; i++ ) {
            const c = word.charAt( i );

            if( node.child_nodes.has( c ) )
                node = node.child_nodes.get( c );
            else
                return;
        }

        this.gatherNodeResults( node, articles, tags, projects );
    }
}

/**
 * Gets JSON source objects that match part or all of a search string
 * @param str      Search string
 * @param articles Array to store Article JSON source objects
 * @param tags     Array to store Tag JSON source objects
 * @param projects Array to store Project JSON source objects
 */
Search.prototype.getResults = function( str, articles, tags, projects ) {
    const words         = ( str.toLowerCase() ).split( " " );
    let   exact_words   = []; //any word with quotations
    let   partial_words = []; //any word without quotations
    const regex         = new RegExp( "([\"'])(?:(?=(\\\\?))\\2.)*?\\1" ); //from S.O.

    //Separate quoted and non-quoted words from the search string
    for( let i = 0; i < words.length; ++i ) {
        if( words[i].length ) {
            if( regex.test( words[i] ) )
                exact_words.push( words[i].substring( 1, words[i].length - 1 ) );
            else
                partial_words.push( words[i] );
        }
    }

    //Get all the matches for the exact and partial words in each categories
    let article_sets  = [];
    let tag_sets      = [];
    let projects_sets = [];

    for( let i = 0; i < exact_words.length; ++i ) {
        let a = article_sets.push( new Set() ) - 1;
        let t = tag_sets.push( new Set() ) - 1;
        let p = projects_sets.push( new Set() ) - 1;

        this.getExactResults( exact_words[i], article_sets[a], tag_sets[t], projects_sets[p] );
    }

    for( let i = 0; i < partial_words.length; ++i ) {
        let a = article_sets.push( new Set() ) - 1;
        let t = tag_sets.push( new Set() ) - 1;
        let p = projects_sets.push( new Set() ) - 1;

        this.getPartialResults( partial_words[i], article_sets[a], tag_sets[t], projects_sets[p] );
    }

    if( ( exact_words.length + partial_words.length ) < 2 ) { //1 word so just collect everything

        article_sets.forEach( ( set ) => {
               set.forEach( ( val ) => { articles.push( val ); } )
        } );

        tag_sets.forEach( ( set ) => {
            set.forEach( ( val ) => { tags.push( val ); } )
        } );

        projects_sets.forEach( ( set ) => {
            set.forEach( ( val ) => { projects.push( val ); } )
        } );

    } else { //intersection (str1 AND str2 AND ...)

        if( article_sets.length ) {
            article_sets[0].forEach( value => {
                for( let i = 1; i < article_sets.length; ++i ) {
                    if( !article_sets[i].has( value ) )
                        return;
                }
                articles.push( value );
            } );
        }

        if( tag_sets.length ) {
            tag_sets[0].forEach( value => {
                for( let i = 1; i < tag_sets.length; ++i ) {
                    if( !tag_sets[i].has( value ) )
                        return;
                }
                tags.push( value );
            } );
        }

        if( projects_sets.length ) {
            projects_sets[0].forEach( value => {
                for( let i = 1; i < projects_sets.length; ++i ) {
                    if( !projects_sets[i].has( value ) )
                        return;
                }
                projects.push( value );
            } );
        }
    }
}

/**
 * Writes into HTML DOM the search results
 * @param articles List of articles found
 * @param tags     List of tags found
 * @param projects List of projects found
 */
Search.prototype.populateSearchResults = function( articles, tags, projects ) {
    const url_prefix     = "../"; //<== dependant on the search result's page location and the root of the blog
    const container_msg  = document.getElementById( "search-msg" );
    const container_a    = document.getElementById( "article-results-out" );
    const container_t    = document.getElementById( "tag-results-out" );
    const container_p    = document.getElementById( "project-results-out" );

    container_a.innerHTML = "";
    container_t.innerHTML = "";
    container_p.innerHTML = "";

    if( document.getElementById( "show-articles" ).checked )
        blogator.showSearchResults( "articles" );

    if( document.getElementById( "show-tags" ).checked )
        blogator.showSearchResults( "tags" );

    if( document.getElementById( "show-projects" ).checked )
        blogator.showSearchResults( "projects" );

    if( articles.length || tags.length || projects.length ) {

        articles.forEach( value => {
            let html = `<a href="${url_prefix}${value.href}">
                            <div>
                                <h3>${value.title}</h3>
                                <span class="date-stamp">${value.date}</span>
                            </div>
                            <div>
                                <div class="tags">`

            value.tags.forEach( tag => { html += `<span class="tag">${tag}</span>`; } )

            html +=             `</div>
                            </div>
                        </a>`;

            container_a.innerHTML += html;
        } );

        tags.forEach( value => {
            container_t.innerHTML +=
                `<a href="${url_prefix}${value.href}">
                    <h3>${value.name}</h3>
                </a>`;
        } );

        projects.forEach( value => {
            let html = `<a href="${value.href}">
                            <div>
                                <h3>${value.name}</h3>
                                <span class="date-stamp">${value.year}</span>
                            </div>
                            <div>
                                <div class="tags">`;

            value.tags.forEach( tag => { html += `<span class="tag">${tag}</span>`; } );

            html +=         `</div>
                        </div>
                    </a>`;

            container_p.innerHTML += html;
        } );

        container_msg.style.display = 'none';

    } else {
        container_msg.style.display = 'block';
    }
}

/**
 * Fetch search results
 */
Search.prototype.getSearchResults = function () {
    let   articles = [];
    let   tags     = [];
    let   projects = [];
    const field    = document.getElementById( "find-posts-in" );

    this.getResults( field.value, articles, tags, projects );
    this.populateSearchResults( articles, tags, projects );
}

/**
 * Fetch search results
 * @param str Search parameter received from 'POST' args
 */
Search.prototype.postSearchResults = function( str ) {
    document.getElementById( "find-posts-in" ).value = str;
    this.getSearchResults();
}

/**
 * Triggers fetching the search results on "Enter"
 * @param event Key event
 */
Search.prototype.checkKeyEvent = function( event ) {
    if( event.key === "Enter" )
        blogator.search.getSearchResults();
}


/* ========================================== BLOGATOR ========================================== */
blogator.SRC_TYPE = Object.freeze( { "article": 1, "heading": 2, "tag": 3, "project": 4 } );
blogator.search   = new Search();

/**
 * Loads JSON index file
 * @param url      JSON index file URL
 * @param callback Callback to function for processing JSON index file
 */
blogator.loadJSON = function( url, callback ) {
    let req = new XMLHttpRequest();
    req.overrideMimeType( "application/json" );
    req.open( 'GET', url, true );

    req.onreadystatechange = function () {
        if( req.readyState === 4 && req.status === 200 )
            callback( req.responseText, blogator.loadSearch );
    };

    req.send( null );
}

/**
 * Process JSON index file
 * @param data     Collection of JSON index files to parse and concatenate
 * @param callback Callback to function loading the search results
 */
blogator.processJSON = function( data, callback ) {
    blogator.search.index_json = JSON.parse( data );
    blogator.search.index_json["articles"].forEach( ( o ) => { blogator.search.index_grove.addArticle( o ); } )
    blogator.search.index_json["tags"].forEach( ( o ) => { blogator.search.index_grove.addTag( o ); } )
    blogator.search.index_json["projects"].forEach( ( o ) => { blogator.search.index_grove.addProject( o ); } )
    console.log( "[Blogator] JSON blog index processed." );
    callback();
}

/**
 * Loads the search results
 */
blogator.loadSearch = function() {
    const regex  = new RegExp( "\\?search-string=(.*)" );
    let   result = regex.exec( decodeURIComponent( window.location.search ) );

    if( result && result.length > 1 )
        blogator.search.postSearchResults( result[1] );
}

/**
 * Control the visibility of result divs based on choices in checkboxes
 * @param cat Search result category
 */
blogator.showSearchResults = function( cat ) {
    const article_wrapper = document.getElementById( "article-results" );
    const article_opt     = document.getElementById( "show-articles" );
    const tag_div         = document.getElementById( "tag-results-out" );
    const tag_opt         = document.getElementById( "show-tags" );
    const project_wrapper = document.getElementById( "project-results" );
    const project_opt     = document.getElementById( "show-projects" );

    switch ( cat ) {
        case "articles": {
            if( article_opt.checked ) {
                article_wrapper.style.display = 'flex';
            } else {
                article_wrapper.style.display = 'none';
            }
            break;
        }
        case "tags": {
            if( tag_opt.checked )
                tag_div.style.display = 'flex';
            else
                tag_div.style.display = 'none';
            break;
        }
        case "projects": {
            if( project_opt.checked ) {
                project_wrapper.style.display = 'flex';
            } else {
                project_wrapper.style.display = 'none';
            }
            break;
        }
    }
}


/* =========================================== GLOBAL =========================================== */
window.onload = function loadIndexJSON() {
    blogator.loadJSON( BLOGATOR_JSON_PATH, blogator.processJSON );
    console.log( blogator.search.index_grove );
    document.getElementById( "search-msg-no-js" ).style.display = 'none';
    document.getElementById( "search-msg" ).style.display       = 'block';
}