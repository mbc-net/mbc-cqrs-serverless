"""
MCP Server entry point
"""
import os
import sys
import asyncio
import logging

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from mcp_server.server import mcp

if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv('PORT', 8000))
    host = os.getenv('HOST', '0.0.0.0')
    
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)
    
    logger.info(f"Starting MCP Server on {host}:{port}")
    
    uvicorn.run(
        mcp,
        host=host,
        port=port,
        log_level="info"
    )
