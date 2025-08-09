import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import * as fs from 'fs/promises';
import * as path from 'path';
import { isAxiosError } from 'axios';
import * as https from 'https';

@Injectable()
export class AgentxService {
  constructor(private readonly httpService: HttpService) {}

  async processPromptFile(): Promise<{ message: string; outputPath: string }> {
    // --- Parameters to be configured ---
    const API_KEY = process.env.DIFY_API_KEY || 'app-sdmIGoNegUyoQLN2FTN1u7SY'; // 请替换为您的API密钥
    const USER_ID = 'test-user';
    const INPUT_PROMPT_PATH = path.resolve(process.cwd(), '..', 'prompt.txt');
    const OUTPUT_PROMPT_PATH = path.resolve(
      process.cwd(),
      '..',
      'prompt.output.txt',
    );
    const DIFY_API_URL = 'https://api.dify.ai/v1/workflows/run'; // 修改为工作流API端点
    // ------------------------------------

    try {
      const promptContent = await fs.readFile(INPUT_PROMPT_PATH, 'utf-8');

      console.log('=== 开始处理Dify工作流请求 ===');
      console.log('API URL:', DIFY_API_URL);
      console.log('API Key前缀:', API_KEY.substring(0, 15) + '...');
      console.log('用户ID:', USER_ID);
      console.log('Prompt内容长度:', promptContent.length);

      // 保持完整prompt，优先保证代码完整性
      console.log('🔄 使用完整prompt进行处理，保证代码完整性');
      
      let finalResult = '';
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          console.log(`🔄 第 ${retryCount + 1} 次尝试处理完整prompt...`);
          
          // 使用异步模式避免504超时
          finalResult = await this.makeAsyncRequest(
            API_KEY,
            USER_ID,
            promptContent,
          );
          
          console.log('✅ 完整prompt处理成功！');
          break;
          
        } catch (error) {
          retryCount++;
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.log(`❌ 第 ${retryCount} 次尝试失败:`, errorMessage);
          
          if (errorMessage.includes('504') || errorMessage.includes('timeout')) {
            console.log(`⏰ 检测到超时错误，可能Dify仍在后台处理...`);
            
            if (retryCount < maxRetries) {
              const waitTime = 30 + (retryCount * 30); // 30s, 60s, 90s
              console.log(`⏳ 等待 ${waitTime} 秒后重试（Dify可能仍在处理）...`);
              await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
            }
          } else if (retryCount >= maxRetries) {
            throw error;
          }
        }
      }
      
      if (!finalResult) {
        throw new Error('所有重试尝试都失败了');
      }
      
      // 保存最终结果
      await fs.writeFile(OUTPUT_PROMPT_PATH, finalResult, 'utf-8');
      console.log('💾 结果已保存到:', OUTPUT_PROMPT_PATH);
      
      return {
        message: 'Prompt processed successfully with full content integrity.',
        outputPath: OUTPUT_PROMPT_PATH,
      };
    } catch (error) {
      if (isAxiosError(error)) {
        console.error('=== Dify API 请求错误详情 ===');
        console.error('错误类型:', error.code);
        console.error('错误消息:', error.message);
        console.error('请求URL:', DIFY_API_URL);
        console.error('API密钥前缀:', API_KEY.substring(0, 10) + '...');

        if (error.code === 'ECONNABORTED') {
          console.error('❌ 连接超时 - 可能的原因:');
          console.error('  1. 网络连接问题');
          console.error('  2. 防火墙阻止访问 api.dify.ai');
          console.error('  3. 需要配置代理服务器');
          console.error('  4. DNS解析问题');
        } else if (error.code === 'ENOTFOUND') {
          console.error('❌ DNS解析失败 - 无法找到 api.dify.ai');
        } else if (error.code === 'ECONNREFUSED') {
          console.error('❌ 连接被拒绝 - 目标服务器拒绝连接');
        }

        if (error.response) {
          console.error('响应状态码:', error.response.status);
          console.error('响应数据:', error.response.data);
        }
        console.error('========================');
      } else {
        console.error('Error processing prompt:', error);
      }
      throw new Error('Failed to process prompt file.');
    }
  }

  /**
   * 使用原生HTTPS模块发送请求（扩展超时版本）
   */
  private async makeNativeHttpsRequestWithExtendedTimeout(
    apiKey: string,
    userId: string,
    promptContent: string,
  ): Promise<string> {
    // 超长超时时间，给Dify充分的处理时间
    const EXTENDED_TIMEOUT = 300000; // 5分钟

    const apiEndpoints = [
      {
        name: 'Chat',
        path: '/v1/chat-messages',
        requestBody: {
          inputs: {},
          query: promptContent,
          response_mode: 'blocking',
          user: userId,
        },
      },
      {
        name: 'Workflow',
        path: '/v1/workflows/run',
        requestBody: {
          inputs: {
            prompt: promptContent,
          },
          response_mode: 'blocking',
          user: userId,
        },
      },
    ];

    for (const endpoint of apiEndpoints) {
      try {
        console.log(`🔄 尝试 ${endpoint.name} API（扩展超时 ${EXTENDED_TIMEOUT/1000}s）...`);
        const result = await this.makeHttpsRequestWithTimeout(
          apiKey,
          endpoint.path,
          endpoint.requestBody,
          EXTENDED_TIMEOUT,
        );
        return result;
      } catch (error: any) {
        console.log(`❌ ${endpoint.name} API 失败:`, error.message);
        
        if (endpoint === apiEndpoints[apiEndpoints.length - 1]) {
          throw error;
        }
      }
    }

    throw new Error('All API endpoints failed');
  }

  /**
   * 带自定义超时时间的HTTPS请求
   */
  private async makeHttpsRequestWithTimeout(
    apiKey: string,
    path: string,
    requestBody: any,
    timeoutMs: number,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(requestBody);
      
      const options = {
        hostname: 'api.dify.ai',
        port: 443,
        path: path,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
        timeout: timeoutMs,
      };

      console.log(`📤 发送HTTPS请求到: ${path}`);
      console.log(`⏱️  超时设置: ${timeoutMs/1000}秒`);

      const req = https.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          console.log(`✅ HTTPS响应状态: ${res.statusCode}`);
          
          if (res.statusCode === 200) {
            try {
              const parsedResponse = JSON.parse(responseData);
              console.log('🔍 解析后的响应对象:', JSON.stringify(parsedResponse, null, 2));
              console.log('🔍 响应对象的所有键:', Object.keys(parsedResponse));

              // 尝试多种可能的响应字段
              let extractedContent = '';
              
              if (parsedResponse.answer) {
                extractedContent = parsedResponse.answer;
              } else if (parsedResponse.data?.outputs) {
                const outputs = parsedResponse.data.outputs;
                extractedContent = outputs.result || outputs.output || outputs.answer || outputs.text || JSON.stringify(outputs);
              } else if (parsedResponse.data?.answer) {
                extractedContent = parsedResponse.data.answer;
              } else if (typeof parsedResponse === 'string') {
                extractedContent = parsedResponse;
              } else {
                extractedContent = JSON.stringify(parsedResponse);
              }

              console.log('📤 提取的内容长度:', extractedContent.length);
              resolve(extractedContent);
            } catch (parseError: any) {
              console.log('❌ 响应解析失败:', parseError.message);
              console.log('📦 原始响应数据:', responseData);
              reject(new Error(`响应解析失败: ${parseError.message}`));
            }
          } else {
            console.log('📦 响应数据:', responseData);
            reject(new Error(`API错误 (${res.statusCode}): ${responseData}`));
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`请求超时 (${timeoutMs/1000}秒)`));
      });

      req.on('error', (error: any) => {
        reject(new Error(`请求错误: ${error.message}`));
      });

      req.write(data);
      req.end();
    });
  }

  /**
   * 使用异步模式避免504超时
   */
  private async makeAsyncRequest(
    apiKey: string,
    userId: string,
    promptContent: string,
  ): Promise<string> {
    console.log('🔄 使用异步模式处理prompt...');
    
    // 1. 发起异步请求
    const taskId = await this.submitAsyncTask(apiKey, userId, promptContent);
    console.log('📝 任务已提交，任务ID:', taskId);
    
    // 2. 轮询结果
    const result = await this.pollTaskResult(apiKey, taskId);
    return result;
  }

  /**
   * 提交异步任务
   */
  private async submitAsyncTask(
    apiKey: string,
    userId: string,
    promptContent: string,
  ): Promise<string> {
    const requestBody = {
      inputs: {},
      query: promptContent,
      response_mode: 'streaming', // 使用流模式，通常支持更长处理时间
      user: userId,
    };

    return new Promise((resolve, reject) => {
      const data = JSON.stringify(requestBody);
      
      const options = {
        hostname: 'api.dify.ai',
        port: 443,
        path: '/v1/chat-messages',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
        timeout: 30000, // 只需要30秒提交任务
      };

      const req = https.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              // 流模式返回的是事件流，我们需要解析最后的完整响应
              const lines = responseData.split('\n');
              let finalResponse = '';
              
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const jsonStr = line.substring(6);
                  if (jsonStr.trim() && jsonStr !== '[DONE]') {
                    try {
                      const parsed = JSON.parse(jsonStr);
                      if (parsed.answer) {
                        finalResponse += parsed.answer;
                      }
                    } catch (e) {
                      // 忽略解析错误的行
                    }
                  }
                }
              }
              
              if (finalResponse) {
                resolve(finalResponse);
              } else {
                // 如果流模式没有结果，说明还在处理中
                resolve('PROCESSING');
              }
            } catch (error: any) {
              reject(new Error(`异步任务提交失败: ${error.message}`));
            }
          } else {
            reject(new Error(`任务提交失败 (${res.statusCode}): ${responseData}`));
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('任务提交超时'));
      });

      req.on('error', (error: any) => {
        reject(new Error(`任务提交错误: ${error.message}`));
      });

      req.write(data);
      req.end();
    });
  }

  /**
   * 轮询任务结果（备用方案）
   */
  private async pollTaskResult(apiKey: string, taskId: string): Promise<string> {
    // 如果直接从流中得到了结果，直接返回
    if (taskId !== 'PROCESSING') {
      return taskId;
    }
    
    // 否则实现简单的等待重试机制
    console.log('⏳ 任务正在处理中，等待完成...');
    
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 30000)); // 等待30秒
      
      console.log(`🔄 第 ${i + 1} 次检查任务状态...`);
      
      // 重新尝试获取结果
      try {
        const result = await this.makeSimpleRequest(apiKey, 'test-user', '请问刚才的转换结果如何？');
        if (result && result !== '处理完成' && result.length > 100) {
          console.log('✅ 检测到有效结果');
          return result;
        }
      } catch (error) {
        console.log(`❌ 第 ${i + 1} 次检查失败`);
      }
    }
    
    throw new Error('异步任务处理超时');
  }

  /**
   * 简单请求（用于状态检查）
   */
  private async makeSimpleRequest(
    apiKey: string,
    userId: string,
    query: string,
  ): Promise<string> {
    const requestBody = {
      inputs: {},
      query: query,
      response_mode: 'blocking',
      user: userId,
    };

    return new Promise((resolve, reject) => {
      const data = JSON.stringify(requestBody);
      
      const options = {
        hostname: 'api.dify.ai',
        port: 443,
        path: '/v1/chat-messages',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
        timeout: 10000,
      };

      const req = https.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const response = JSON.parse(responseData);
              resolve(response.answer || 'no answer');
            } catch (error: any) {
              reject(new Error(`解析失败: ${error.message}`));
            }
          } else {
            reject(new Error(`请求失败 (${res.statusCode})`));
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('简单请求超时'));
      });

      req.on('error', (error: any) => {
        reject(new Error(`简单请求错误: ${error.message}`));
      });

      req.write(data);
      req.end();
    });
  }
}
