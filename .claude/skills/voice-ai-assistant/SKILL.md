---
name: voice-ai-assistant
description: Extract data from speech, generate natural responses, detect intent, validate data. Use for conversational AI and natural language processing.
---

# Voice AI Assistant

Reusable Claude AI capabilities for voice AI operations - data extraction, response generation, intent detection, and conversation handling.

## Quick Start

```javascript
const claude = require('./services/claudeAI');

// Extract address from speech
const address = await claude.extractData("123 main street canton", "address");

// Generate natural response
const response = await claude.generateResponse('greeting', { customerName: 'John' });

// Detect intent
const intent = await claude.detectIntent(speech, ['get_quote', 'book_move']);
```

## Core Skills

### 1. Extract Structured Data

Extract specific information from natural, messy speech.

**Supported Data Types**:
- `address` - Street, city, state, zip
- `date` - Natural date parsing ("next friday", "tomorrow")
- `name` - First and last name
- `email` - Spoken email addresses
- `phone` - Phone numbers
- `timeSlot` - Time preferences
- `yesNo` - Yes/no answers with confidence
- `custom` - Custom extraction with your own context

**Usage**:
```javascript
const result = await claude.extractData("uh yeah 123 main street canton", "address");
// Returns: { success: true, data: { street: "123 Main Street", city: "Canton", state: "OH" } }

const dateResult = await claude.extractData("next friday", "date");
// Returns: { success: true, data: { date: "2024-12-08", dayOfWeek: "Friday" } }
```

**Implementation Details**:
- Model: claude-3-5-sonnet-20241022
- Temperature: 0.3 (for consistency)
- Max tokens: 200
- Returns structured JSON with success flag

### 2. Generate Natural Responses

Generate conversational, human-like responses.

**Supported Intent Types**:
- `greeting` - Welcome messages
- `question` - Ask for information
- `confirmation` - Confirm actions
- `error` - Apologize and offer help
- `transition` - Move conversation forward
- `custom` - Custom response with your own purpose/tone

**Usage**:
```javascript
const greeting = await claude.generateResponse('greeting', { customerName: 'John' });
// Returns: "Hi John! Thanks for calling. How can I help you today?"

const confirmation = await claude.generateResponse('confirmation', {
    action: 'booking created',
    date: '2024-12-01'
});
// Returns: "Perfect! Your move is all set for December 1st."
```

**Implementation Details**:
- Temperature: 0.8 (higher for natural variation)
- Max tokens: 300
- Style: Short (1-2 sentences), warm, conversational

### 3. Detect Customer Intent

Understand what the customer wants to do.

**Usage**:
```javascript
const result = await claude.detectIntent(
    "I want to schedule a move for next week",
    ["get_quote", "book_move", "check_booking", "reschedule"]
);
// Returns: { intent: "book_move", confidence: "high", reasoning: "..." }
```

### 4. Validate and Clean Data

Check if extracted data is valid and clean it.

**Usage**:
```javascript
const emailCheck = await claude.validateData('email', 'john@gmail.com');
// Returns: { valid: true, cleaned: "john@gmail.com", reason: "Valid email format" }

const phoneCheck = await claude.validateData('phone', '3305551234');
// Returns: { valid: true, cleaned: "+13305551234", reason: "Valid US number" }
```

### 5. Extract Multiple Data Points

Extract multiple pieces of information in parallel.

**Usage**:
```javascript
const result = await claude.extractMultiple(
    "Hi, I'm John Smith, email is john@gmail.com, moving next friday",
    ["name", "email", "date"]
);
// Returns: {
//     name: { firstName: "John", lastName: "Smith" },
//     email: { email: "john@gmail.com" },
//     date: { date: "2024-12-08" }
// }
```

## Integration Examples

### Twilio Voice AI
```javascript
async function handleCustomerAddress(speech) {
    const result = await claude.extractData(speech, 'address');

    if (result.success && result.data.street) {
        const response = await claude.generateResponse('confirmation', {
            action: 'address received',
            address: `${result.data.street}, ${result.data.city}`
        });
        return response.text;
    }
}
```

### Chatbot Integration
```javascript
async function handleChatMessage(message) {
    const intent = await claude.detectIntent(message, [
        'get_quote', 'book_move', 'ask_question'
    ]);

    if (intent.intent === 'get_quote') {
        const details = await claude.extractMultiple(message, ['address', 'date']);
        // Process quote request
    }
}
```

## Error Handling

All functions return structured responses with `success` field:

```javascript
const result = await claude.extractData(speech, 'address');

if (!result.success) {
    console.error('Extraction failed:', result.error);
    // Handle failure gracefully
}
```

## Configuration

```javascript
const config = {
    model: 'claude-3-5-sonnet-20241022',
    maxTokensExtraction: 200,
    maxTokensGeneration: 300
};
```

## Cost Estimation

**Per API Call**:
- Data extraction: ~$0.001-0.003
- Response generation: ~$0.002-0.005
- Intent detection: ~$0.001-0.002

**Typical 5-minute voice call**:
- 3-5 extractions: ~$0.005
- 5-8 responses: ~$0.020
- Total: ~$0.008-0.015 per call

## Best Practices

1. **Always check success field** before using data
2. **Use appropriate temperature**: 0.3 for extraction, 0.8 for generation
3. **Provide context**: Better prompts = better results
4. **Batch extractions**: Use extractMultiple for efficiency
5. **Cache common responses**: Reduce API calls for frequent phrases

## Troubleshooting

**Invalid JSON response**:
- Service automatically strips markdown code blocks
- Check ANTHROPIC_API_KEY is valid

**High latency**:
- Claude typically responds in 500-1500ms
- Consider caching common responses

**Incorrect extraction**:
- Review context and expectedFormat in options
- Check console logs for extraction results
- Temperature is set to 0.3 for consistency

## Environment Variables

```
ANTHROPIC_API_KEY=sk-ant-api03-...
```

Get your key: https://console.anthropic.com/settings/keys

## File Location

**Implementation**: `services/claudeAI.js`
