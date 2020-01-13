
function parseCommits(instream, outstream) {

    var sha, author, message, date;
    var lineStart = 0;

    const commitRE = /^commit /;
    const authorRE = /^Author:/;
    const messagePrefixRE = /^    /;
    var commitSep = '\n';
    const nextCommitSep = '\n,';

    outstream.write('[');

    var lineBufs = [];
    var lineBufSize = 0;

    var lineNum = 0;

    function parseBlock(block) {
        for (var i = 0; i < block.length; ++i) {
            while (block[i] !== 10 && i < block.length) ++i;
            if (i < block.length) {
                var buf = block;
                if (lineBufs.length > 0) {
                    lineBufs.push(block);
                    buf = Buffer.concat(lineBufs);
                    lineBufs.splice(0);
                }
                const line = buf.slice(lineStart, lineBufSize + i).toString();
                if (line.length > 0) {
                    if (commitRE.test(line)) {
                        if (sha) {
                            const commit = {sha, author, message: message.join("\n"), date, files};
                            // if (!author) console.error(commit, lineNum, lineStart, lineBufSize, lastCommit);
                            outstream.write(commitSep + JSON.stringify(commit));
                            commitSep = nextCommitSep;
                        }
                        sha = line.substring(7);
                        author = date = undefined;
                        message = [];
                        files = [];
                    }
                    else if (authorRE.test(line)) author = line.substring(8);
                    else if (author && !date) date = new Date(line.substring(6)).getTime();
                    else if (author && date) {
                        if (buf[lineStart] === 32) message.push(line.replace(messagePrefixRE, ''));
                        else {
                            const [action, path, renamed] = line.split("\t");
                            files.push({action, path, renamed});
                        }
                    }
                }
                lineNum++;
                lineStart = (i+1 < block.length) ? i+1 : 0;
                lineBufs.splice(0);
                lineBufSize = 0;
            } else {
                lineBufs.push(block);
                lineBufSize += block.length;
            }
        }
    }

    instream.on('data', parseBlock);
    instream.on('end', () => {
        if (sha) {
            const commit = {sha, author, message: message.join("\n"), date, files};
            outstream.write(commitSep + JSON.stringify(commit));
        }
        outstream.write(']');
        outstream.end();
    });
}

parseCommits(process.stdin, process.stdout);