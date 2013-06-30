import SimpleHTTPServer
import SocketServer

# minimal web server.  serves files relative to the
# current directory.
def main():
    import sys
    try:
        port = int(sys.argv[1])
    except:
        port = 8000

    Handler = SimpleHTTPServer.SimpleHTTPRequestHandler
    httpd = SocketServer.TCPServer(("", port), Handler)

    print "serving at port", port
    httpd.serve_forever()

if __name__ == "__main__":
    main()
