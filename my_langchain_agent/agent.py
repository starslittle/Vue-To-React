import os
import getpass
import requests
import datetime
import configparser
from langchain_community.chat_models import ChatTongyi
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.output_parsers import StrOutputParser
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_tavily import TavilySearch
from langchain_core.tools import tool
from langchain_text_splitters import RecursiveCharacterTextSplitter
import simple_vectorstore # 导入您的向量数据库

# 步骤 1 & 2 & 3: 定义一个新工具并用 @tool 装饰，同时写好文档字符串
@tool
def get_word_length(word: str) -> int:
    """当你需要计算一个单词的长度时，调用这个工具。"""
    return len(word)

@tool
def get_seniverse_weather(location: str) -> str:
    """
    当你需要查询某个中国城市的当前天气时，请使用此工具。
    输入必须是中文城市名，例如：'北京' 或 '杭州'。
    """
    api_key = os.getenv("SENIVERSE_API_KEY")
    if not api_key:
        return "错误：未配置心知天气(Seniverse) API 私钥。"

    base_url = "https://api.seniverse.com/v3/weather/now.json"
    params = {
        'key': api_key,
        'location': location,
        'language': 'zh-Hans',
        'unit': 'c'
    }
    
    try:
        response = requests.get(base_url, params=params)
        response.raise_for_status()
        data = response.json()['results'][0]
        
        city_name = data['location']['name']
        weather_text = data['now']['text']
        temp = data['now']['temperature']
        
        return f"{city_name}的天气情况：{weather_text}，当前温度：{temp}°C。"
        
    except requests.exceptions.HTTPError as http_err:
        return f"错误：获取心知天气信息时发生网络错误。 {http_err}"
    except Exception as e:
        return f"处理心知天气信息时发生未知错误: {e}"

@tool
def get_current_date() -> str:
    """当你需要查询今天的日期时，请使用此工具。"""
    return datetime.date.today().strftime("%Y年%m月%d日")

@tool
def split_text(text: str, chunk_size: int = 1000, chunk_overlap: int = 200) -> list[str]:
    """
    当你需要将长文本分割成更小的、可管理的块时，调用这个工具。
    例如，你有一个很长的文档，想要分块处理或分析。
    参数：
    - text (str): 需要分割的文本。
    - chunk_size (int): 每个文本块的最大长度（默认为 1000）。
    - chunk_overlap (int): 相邻文本块之间的重叠长度（默认为 200），有助于保留上下文。
    返回:
    - list[str]: 分割后的文本块列表。
    """
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
        is_separator_regex=False,
    )
    texts = text_splitter.split_text(text)
    return texts

# 实例化向量数据库（可以在这里或在main函数中）
# 为了方便在工具中使用，我们将其作为全局变量（或在main中传递）
# 注意：在生产环境中，可能需要更复杂的单例模式或依赖注入
vector_store_instance = None # 初始化为 None，在 main 中实例化
text_splitter_instance = None # 初始化为 None，在 main 中实例化

@tool
def load_documents_from_file_to_vectorstore(file_path: str) -> str:
    """
    当你需要将本地文本文件（如TXT文件）的内容加载到向量数据库中时，调用此工具。
    它会读取文件，分割文本，然后添加到向量数据库。
    参数：
    - file_path (str): 本地文件的完整路径。
    返回:
    - str: 操作结果消息。
    """
    if not os.path.exists(file_path):
        return f"错误：文件 {file_path} 不存在。"
    
    if vector_store_instance is None or text_splitter_instance is None:
        return "错误：向量数据库或文本分割器未初始化。请联系开发者。"

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 使用之前定义的文本分割器实例进行分割
        texts = text_splitter_instance.split_text(content)
        vector_store_instance.add_documents(texts)
        return f"成功从文件 {file_path} 加载并添加了 {len(texts)} 个文档块到向量数据库。"
    except Exception as e:
        return f"加载文件时发生错误: {e}"

@tool
def query_documents_from_vectorstore(query: str, k: int = 4) -> str:
    """
    当你需要从向量数据库中检索与查询最相似的文档时，调用此工具。
    参数：
    - query (str): 用于搜索的查询文本。
    - k (int): 返回最相似文档的数量（默认 5 个）。你可以通过在问题中指定“返回多少个”来控制，例如“列出关于XXX的5个相似文档”。
    返回:
    - str: 最相似文档的文本内容及其相似度，或未找到文档的消息。
    """
    if vector_store_instance is None:
        return "错误：向量数据库未初始化。请联系开发者。"
    
    try:
        found_docs = vector_store_instance.similarity_search(query, k=k)
        if found_docs:
            result_str = "从向量数据库中找到以下相似文档：\n"
            for doc_info in found_docs:
                result_str += f"- 文本: {doc_info['text'][:200]}..., 相似度: {doc_info['similarity']:.4f}\n"
            return result_str
        else:
            return f"未在向量数据库中找到与 '{query}' 相似的文档。"
    except Exception as e:
        return f"从向量数据库查询时发生错误: {e}"

def main():
    """
    主函数，用于设置和运行 Langchain 智能体。
    """
    global vector_store_instance, text_splitter_instance # 声明全局变量
    config = configparser.ConfigParser()
    config_file = 'config.ini'
    
    # 尝试从配置文件加载 API 密钥
    if os.path.exists(config_file):
        config.read(config_file)
        if 'api_keys' in config:
            if 'dashscope_api_key' in config['api_keys']:
                os.environ["DASHSCOPE_API_KEY"] = config['api_keys']['dashscope_api_key']
            if 'tavily_api_key' in config['api_keys']:
                os.environ["TAVILY_API_KEY"] = config['api_keys']['tavily_api_key']
            if 'seniverse_api_key' in config['api_keys']:
                os.environ["SENIVERSE_API_KEY"] = config['api_keys']['seniverse_api_key']

    # 如果环境变量中没有密钥，则提示用户输入并保存到配置文件
    if "DASHSCOPE_API_KEY" not in os.environ:
        dashscope_key = getpass.getpass("请输入你的 Dashscope API 密钥: ")
        os.environ["DASHSCOPE_API_KEY"] = dashscope_key
        config['api_keys'] = {'dashscope_api_key': dashscope_key}
        
    if "TAVILY_API_KEY" not in os.environ:
        tavily_key = getpass.getpass("请输入你的 Tavily API 密钥: ")
        os.environ["TAVILY_API_KEY"] = tavily_key
        if 'api_keys' not in config:
            config['api_keys'] = {}
        config['api_keys']['tavily_api_key'] = tavily_key
        
    if "SENIVERSE_API_KEY" not in os.environ:
        seniverse_key = getpass.getpass("请输入你的心知天气 API 私钥: ")
        os.environ["SENIVERSE_API_KEY"] = seniverse_key
        if 'api_keys' not in config:
            config['api_keys'] = {}
        config['api_keys']['seniverse_api_key'] = seniverse_key

    # 将密钥写入配置文件
    with open(config_file, 'w') as configfile:
        config.write(configfile)

    llm = ChatTongyi(model="qwen-turbo", temperature=0.7, dashscope_api_key=os.environ["DASHSCOPE_API_KEY"])

    # 实例化文本分割器和向量数据库
    text_splitter_instance = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        length_function=len,
        is_separator_regex=False,
    )
    vector_store_instance = simple_vectorstore.SimpleVectorStore() # 实例化向量数据库

    # 添加所有工具，包括新的向量数据库工具
    tools = [TavilySearch(max_results=1), get_word_length, get_seniverse_weather, get_current_date, split_text, load_documents_from_file_to_vectorstore, query_documents_from_vectorstore]

    # 更新系统提示，告知模型新的工具
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are a helpful assistant. You have access to a search tool, a word length calculator, a tool for checking Chinese weather, a tool to get the current date, a text splitting tool, a tool to load documents from files into a vector database, and a tool to query documents from the vector database. When querying documents from the vector database, you can specify the number of results you want, for example, by asking 'list 5 similar documents about XXX'."),
        MessagesPlaceholder(variable_name="chat_history"), # 添加聊天历史占位符
        ("user", "{input}"),
        ("placeholder", "{agent_scratchpad}"),
    ])
    
    agent = create_tool_calling_agent(llm, tools, prompt)

    agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True)

    print("\n智能体已准备就绪。输入 'exit' 结束对话。")

    chat_history = [] # 初始化聊天历史

    while True:
        user_input = input("你: ")
        if user_input.lower() == 'exit':
            break
        
        try:
            response = agent_executor.invoke({"input": user_input, "chat_history": chat_history})
            print(f"智能体: {response['output']}")
            chat_history.extend([("human", user_input), ("ai", response['output'])]) # 更新聊天历史
        except Exception as e:
            print(f"发生错误: {e}")

if __name__ == "__main__":
    main() 