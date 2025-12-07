# ChatKit TypeScript SDK Documentation

Welcome to the ChatKit TypeScript SDK documentation! This documentation will help you build powerful chat-based applications with streaming responses, interactive widgets, and flexible storage.

## Documentation Index

### Getting Started

- **[Main Documentation](./index.md)** - Overview, installation, quick start, and core concepts
- **[API Reference](./api-reference.md)** - Complete API documentation for all classes and functions

### Core Topics

- **[Widgets](./widgets.md)** - Building interactive UI components with widgets
- **[Stores](./stores.md)** - Implementing persistence layers for threads and attachments
- **[Agents](./agents.md)** - Integrating with OpenAI Agents SDK

## Quick Navigation

### For Beginners

1. Start with the [Main Documentation](./index.md) to understand the core concepts
2. Review the [Widgets Guide](./widgets.md) to learn about building UIs
3. Check out the [Examples](./index.md#examples) section for code samples

### For Implementation

1. Read the [Stores Documentation](./stores.md) to implement persistence
2. Review the [API Reference](./api-reference.md) for method signatures
3. Follow the [Agents Guide](./agents.md) for agent integration

### For Advanced Usage

1. Study [Custom Store Implementation](./stores.md#custom-store-implementation)
2. Learn about [Streaming Widgets](./widgets.md#streaming-widgets)
3. Explore [Advanced Agent Topics](./agents.md#advanced-topics)

## Documentation Structure

```
docs/
├── README.md           # This file
├── index.md            # Main documentation and getting started
├── api-reference.md    # Complete API reference
├── widgets.md          # Widget system documentation
├── stores.md           # Store interface and implementations
└── agents.md           # Agent integration guide
```

## Key Concepts

### Threads and Messages

Threads are conversation containers that hold messages, widgets, and other items. Learn more in the [Main Documentation](./index.md#core-concepts).

### Widgets

Widgets are declarative UI components that can be streamed and updated in real-time. See [Widgets Documentation](./widgets.md) for details.

### Stores

Stores handle persistence of threads, messages, and attachments. Learn how to implement custom stores in [Stores Documentation](./stores.md).

### Agents

Agents enable AI-powered conversations using the OpenAI Agents SDK. See [Agents Documentation](./agents.md) for integration details.

## Examples

Example code is provided throughout the documentation. Key examples include:

- [Basic Server Setup](./index.md#basic-server-setup)
- [Widget Streaming](./index.md#widget-streaming)
- [Agent Integration](./index.md#agent-integration)
- [Custom Store](./stores.md#example-sqlite-store)
- [Custom Converter](./agents.md#custom-converters)

## Additional Resources

- Check the `example/` directory in the repository for complete working examples
- Review the TypeScript source code for detailed type definitions
- See test files in `tests/` for usage patterns

## Contributing

Found an error or want to improve the documentation? Contributions are welcome! Please:

1. Check existing issues
2. Follow the documentation style
3. Include code examples where helpful
4. Test all code samples before submitting

## Support

For questions and issues:

- Check the [API Reference](./api-reference.md) for method details
- Review [Examples](./index.md#examples) for common patterns
- Open an issue on GitHub for bugs or feature requests

