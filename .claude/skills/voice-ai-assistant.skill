# Voice AI Assistant Skill

**Description**: Reusable Claude AI skills for voice AI operations - data extraction, response generation, intent detection, and conversation handling.

**Use Cases**:
- Extract structured data from natural speech (addresses, dates, names, emails)
- Generate human-like conversational responses
- Detect customer intent and route appropriately
- Validate and clean extracted data
- Handle multi-turn conversations with context awareness

---

## Installation

```bash
npm install @anthropic-ai/sdk
```

**Environment Variable Required**:
```
ANTHROPIC_API_KEY=sk-ant-api03-...
```

---

## Usage

Import the Claude AI service:
```javascript
const claude = require('./services/claudeAI');
```

---

## Skill 1: Extract Structured Data

**Function**: `extractData(speech, dataType, options)`

**Purpose**: Extract specific information from natural, messy speech

**Supported Data Types**:
- `address` - Street, city, state, zip
- `date` - Natural date parsing ("next friday", "the 20th", "tomorrow")
- `name` - First and last name
- `email` - Spoken email addresses
- `phone` - Phone numbers
- `timeSlot` - Time preferences (morning, afternoon, specific time)
- `yesNo` - Yes/no answers with confidence
- `custom` - Any custom extraction with your own context

**Example Usage**:
```javascript
// Extract address from messy speech
const result = await claude.extractData(
    "uh yeah 123 main street canton",
    "address"
);
console.log(result.data);
// { street: "123 Main Street", city: "Canton", state: "OH" }

// Extract date with natural language
const dateResult = await claude.extractData(
    "next friday",
    "date"
);
console.log(dateResult.data);
// { date: "2024-12-08", dayOfWeek: "Friday" }

// Extract email from spoken words
const emailResult = await claude.extractData(
    "john at gmail dot com",
    "email"
);
console.log(emailResult.data);
// { email: "john@gmail.com" }

// Custom extraction
const customResult = await claude.extractData(
    "I need 3 movers and a truck",
    "custom",
    {
        context: "Customer is specifying service requirements",
        expectedFormat: "Extract number of movers and whether truck is needed",
        outputExample: '{ "movers": 3, "truck": true }'
    }
);
```

**Response Format**:
```javascript
{
    success: true,
    data: { /* extracted data */ },
    originalSpeech: "what customer said",
    dataType: "address"
}
```

---

## Skill 2: Generate Natural Responses

**Function**: `generateResponse(intentType, context)`

**Purpose**: Generate conversational, human-like responses

**Supported Intent Types**:
- `greeting` - Welcome messages
- `question` - Ask for information
- `confirmation` - Confirm actions
- `error` - Apologize and offer help
- `transition` - Move conversation forward
- `custom` - Custom response with your own purpose/tone

**Example Usage**:
```javascript
// Greeting response
const greeting = await claude.generateResponse('greeting', {
    customerName: 'John'
});
console.log(greeting.text);
// "Hi John! Thanks for calling Worry Free Moving. How can I help you today?"

// Confirmation response
const confirmation = await claude.generateResponse('confirmation', {
    action: 'booking created',
    date: '2024-12-01',
    time: '8:00 AM'
});
console.log(confirmation.text);
// "Perfect! Your move is all set for December 1st in the morning at 8 AM."

// Error handling
const error = await claude.generateResponse('error', {
    issue: 'date unavailable',
    suggestion: 'try different date'
});
console.log(error.text);
// "I'm sorry, we're fully booked that day. Would you like to try a different date?"

// Custom response
const custom = await claude.generateResponse('custom', {
    purpose: 'Explain pricing breakdown',
    tone: 'Friendly but informative',
    constraints: 'Keep under 3 sentences',
    priceDetails: { total: 625, hours: 4, crew: 2 }
});
```

**Response Format**:
```javascript
{
    success: true,
    text: "Generated response text",
    intentType: "greeting"
}
```

---

## Skill 3: Detect Customer Intent

**Function**: `detectIntent(speech, possibleIntents)`

**Purpose**: Understand what customer wants to do

**Example Usage**:
```javascript
const result = await claude.detectIntent(
    "I want to schedule a move for next week",
    ["get_quote", "book_move", "check_booking", "reschedule", "cancel"]
);
console.log(result);
// {
//     success: true,
//     intent: "book_move",
//     confidence: "high",
//     reasoning: "Customer explicitly wants to schedule a move",
//     originalSpeech: "I want to schedule a move for next week"
// }
```

**Response Format**:
```javascript
{
    success: true,
    intent: "detected_intent",
    confidence: "high|medium|low",
    reasoning: "brief explanation",
    originalSpeech: "what customer said"
}
```

---

## Skill 4: Validate and Clean Data

**Function**: `validateData(dataType, value)`

**Purpose**: Check if extracted data is valid and clean it

**Supported Data Types**:
- `email` - Email format validation
- `phone` - US phone number validation
- `date` - Date validity (not in past for moving dates)
- `address` - Address completeness check

**Example Usage**:
```javascript
// Validate email
const emailCheck = await claude.validateData('email', 'john@gmail.com');
console.log(emailCheck);
// { valid: true, cleaned: "john@gmail.com", reason: "Valid email format" }

// Validate incomplete email
const badEmail = await claude.validateData('email', 'john@gmail');
console.log(badEmail);
// { valid: false, cleaned: null, reason: "Incomplete domain" }

// Validate phone
const phoneCheck = await claude.validateData('phone', '3305551234');
console.log(phoneCheck);
// { valid: true, cleaned: "+13305551234", reason: "Valid US number" }
```

**Response Format**:
```javascript
{
    success: true,
    valid: true/false,
    cleaned: "cleaned_value or null",
    reason: "why valid or invalid",
    dataType: "email",
    originalValue: "input"
}
```

---

## Skill 5: Summarize Conversation

**Function**: `summarizeConversation(conversationHistory)`

**Purpose**: Create concise summary of conversation for handoff or logging

**Example Usage**:
```javascript
const history = [
    { role: 'assistant', content: 'What type of service do you need?' },
    { role: 'user', content: 'I need movers and a truck' },
    { role: 'assistant', content: 'How many movers?' },
    { role: 'user', content: '2 movers' },
    { role: 'assistant', content: 'What is your pickup address?' },
    { role: 'user', content: '123 main street canton' }
];

const summary = await claude.summarizeConversation(history);
console.log(summary.summary);
// "Customer needs 2 movers with truck. Pickup at 123 Main Street, Canton. Still need delivery address and move date."
```

**Response Format**:
```javascript
{
    success: true,
    summary: "2-3 sentence summary",
    conversationLength: 6
}
```

---

## Skill 6: Handle Multi-Turn Conversations

**Function**: `handleConversation(messages, systemContext)`

**Purpose**: Full conversational AI with context awareness

**Example Usage**:
```javascript
const messages = [
    { role: 'user', content: 'I need to move next week' },
    { role: 'assistant', content: 'I can help with that! What day works for you?' },
    { role: 'user', content: 'Friday would be perfect' }
];

const systemContext = {
    customerName: 'John',
    serviceType: 'moving',
    systemPrompt: 'You are Sarah, a friendly moving company receptionist.'
};

const response = await claude.handleConversation(messages, systemContext);
console.log(response.reply);
// "Great choice! Friday it is. What time would you prefer - morning or afternoon?"
```

**Response Format**:
```javascript
{
    success: true,
    reply: "Claude's response",
    usage: {
        inputTokens: 150,
        outputTokens: 50
    }
}
```

---

## Helper: Extract Multiple Data Points

**Function**: `extractMultiple(speech, dataTypes)`

**Purpose**: Extract multiple pieces of information in parallel

**Example Usage**:
```javascript
const result = await claude.extractMultiple(
    "Hi, I'm John Smith, email is john@gmail.com, moving next friday",
    ["name", "email", "date"]
);
console.log(result.data);
// {
//     name: { firstName: "John", lastName: "Smith" },
//     email: { email: "john@gmail.com" },
//     date: { date: "2024-12-08", dayOfWeek: "Friday" }
// }
```

---

## Configuration

```javascript
const claude = require('./services/claudeAI');

// Check current configuration
console.log(claude.config);
// {
//     model: 'claude-3-5-sonnet-20241022',
//     fastModel: 'claude-3-5-sonnet-20241022',
//     maxTokensExtraction: 200,
//     maxTokensGeneration: 300
// }
```

---

## Cost Estimation

**Per API Call**:
- Data extraction: ~$0.001-0.003
- Response generation: ~$0.002-0.005
- Intent detection: ~$0.001-0.002
- Validation: ~$0.001-0.002

**Typical Voice Call (5 minutes)**:
- 3-5 extractions: ~$0.005
- 5-8 responses: ~$0.020
- 2-3 validations: ~$0.003
- **Total: ~$0.008-0.015 per call**

Much cheaper than GPT-4 ($0.01-0.02 per call)!

---

## Error Handling

All functions return structured responses with `success` field:

```javascript
const result = await claude.extractData(speech, 'address');

if (!result.success) {
    console.error('Extraction failed:', result.error);
    // Handle failure gracefully
    // result.data will be null
}
```

**Best Practice**: Always check `success` field before using `data`.

---

## Advanced: Custom System Prompts

You can customize extraction behavior:

```javascript
const result = await claude.extractData(
    "moving from apartment 5B at riverside complex",
    "custom",
    {
        context: "Customer is providing apartment details",
        expectedFormat: "Extract building name and unit number",
        outputExample: '{ "building": "Riverside Complex", "unit": "5B" }'
    }
);
```

---

## Integration Examples

### Twilio Voice AI
```javascript
const claude = require('./services/claudeAI');

async function handleCustomerAddress(speech) {
    const result = await claude.extractData(speech, 'address');

    if (result.success && result.data.street) {
        const cleanAddress = `${result.data.street}, ${result.data.city}, ${result.data.state}`;

        // Generate natural confirmation
        const response = await claude.generateResponse('confirmation', {
            action: 'address received',
            address: cleanAddress
        });

        return response.text;
        // "Perfect! I have your address as 123 Main Street, Canton, OH."
    } else {
        const error = await claude.generateResponse('error', {
            issue: 'address unclear',
            suggestion: 'repeat slowly'
        });
        return error.text;
    }
}
```

### Chatbot Integration
```javascript
async function handleChatMessage(message, conversationHistory) {
    // Detect what user wants
    const intent = await claude.detectIntent(message, [
        'get_quote', 'book_move', 'check_status', 'ask_question'
    ]);

    if (intent.intent === 'get_quote') {
        // Extract details
        const details = await claude.extractMultiple(message, [
            'address', 'date', 'serviceType'
        ]);

        // Generate response
        const response = await claude.generateResponse('question', {
            purpose: 'gather remaining information for quote',
            hasAddress: !!details.data.address,
            hasDate: !!details.data.date
        });

        return response.text;
    }
}
```

---

## Testing

```javascript
// Test extraction
const testExtraction = async () => {
    const tests = [
        { speech: "123 main canton", type: "address" },
        { speech: "next friday", type: "date" },
        { speech: "john at gmail dot com", type: "email" }
    ];

    for (const test of tests) {
        const result = await claude.extractData(test.speech, test.type);
        console.log(`${test.type}:`, result.data);
    }
};

testExtraction();
```

---

## Troubleshooting

### "Invalid JSON response"
- Claude occasionally returns markdown code blocks
- The service automatically strips `\`\`\`json` and `\`\`\``
- If still failing, check `ANTHROPIC_API_KEY` is valid

### "High latency"
- Claude API typically responds in 500-1500ms
- For faster responses, use the `FAST_MODEL` (currently same as default)
- Consider caching common responses

### "Incorrect extraction"
- Check the `context` and `expectedFormat` in options
- Temperature is set to 0.3 for consistency
- Review console logs for `🧠 Claude extracted:` messages

---

## References

- **Anthropic API Docs**: https://docs.anthropic.com/
- **Claude Models**: https://www.anthropic.com/claude
- **API Key**: https://console.anthropic.com/settings/keys
- **Pricing**: https://www.anthropic.com/pricing

---

## File Location

**Implementation**: `services/claudeAI.js`
**Skill Definition**: `.claude/skills/voice-ai-assistant.md`

---

## Version

**Current Version**: 1.0.0
**Model**: claude-3-5-sonnet-20241022
**Last Updated**: 2024-10-26
