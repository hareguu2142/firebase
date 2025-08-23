// Very small SSE parser for fetch ReadableStream
export function createSSEDecoder(onEvent) {
  let buffer = '';

  return (chunk) => {
    buffer += chunk;
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';

    for (const part of parts) {
      const lines = part.split('\n');
      let event = 'message';
      let data = '';
      for (const line of lines) {
        if (line.startsWith('event:')) {
          event = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          data += line.slice(5).trim();
        }
      }
      if (data) {
        try {
          onEvent(event, JSON.parse(data));
        } catch {
          onEvent(event, { text: data });
        }
      }
    }
  };
}